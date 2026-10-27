"""Private, stateless facial signals. This module never approves an identity."""
import base64
import hashlib
import hmac
import io
import json
import math
import os
import re
import tempfile
import time
import urllib.request
from pathlib import Path

NOTICE_VERSION = "participant-private-biometric-v1"
NOTICE_VERSIONS = {NOTICE_VERSION, "participant-private-biometric-v2", "participant-private-biometric-v3"}
MAX_BODY = 4_000_000
MAX_IMAGE = 2 * 1024 * 1024
MODEL_MANIFEST = (
    ("yunet", "opencv/face_detection_yunet", "3cc26e7f1014a5ee5d74a42acee58bafc9d0a310", "face_detection_yunet_2023mar.onnx", "8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4"),
    ("sface", "opencv/face_recognition_sface", "3d7082438a6e4551e840c9b2bb60b71e8da4b524", "face_recognition_sface_2021dec.onnx", "0ba9fbfa01b5270c96627c4ef784da859931e02f04419c829e83484087c34e79"),
    ("minifas", "garciafido/minifasnet-v2-anti-spoofing-onnx", "d29c87568ca9b5662da803b10f217c4db20b142b", "minifasnet_v2.onnx", "d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b"),
)
MANIFEST_SHA = hashlib.sha256(json.dumps(MODEL_MANIFEST, separators=(",", ":")).encode()).hexdigest()
_models = None
_quality_detector = None
CAPTURE_QUALITY_MODE = "capture-quality-v1"
CAPTURE_QUALITY_NOTICE = "participant-capture-quality-v1"
CAPTURE_QUALITY_KINDS = {"DOCUMENT_FRONT", "DOCUMENT_BACK", "SELFIE"}
CAPTURE_QUALITY_MODEL_SHA = hashlib.sha256(json.dumps(MODEL_MANIFEST[:1], separators=(",", ":")).encode()).hexdigest()
CAPTURE_QUALITY_REASONS = frozenset({
    "IMAGE_DECODE_FAILED", "IMAGE_TOO_SMALL", "IMAGE_TOO_DARK", "IMAGE_TOO_BRIGHT",
    "IMAGE_LOW_CONTRAST", "IMAGE_BLURRED", "SINGLE_FACE_REQUIRED", "FACE_TOO_SMALL",
    "FACE_OUT_OF_FRAME", "DOCUMENT_FRAME_UNCONFIRMED", "DOCUMENT_TOO_SMALL",
    "DOCUMENT_OUT_OF_FRAME", "DOCUMENT_PORTRAIT_UNCONFIRMED", "QUALITY_SERVICE_UNAVAILABLE",
})


class BiometricError(Exception):
    def __init__(self, code, status=422):
        self.code, self.status = code, status
        super().__init__(code)


def authorize(raw, headers, secret, now=None):
    if not isinstance(secret, str) or not re.fullmatch(r"[a-f0-9]{64}", secret):
        raise BiometricError("BIOMETRIC_SERVICE_NOT_CONFIGURED", 503)
    timestamp = headers.get("X-Obrasaas-Timestamp", "")
    nonce = headers.get("X-Obrasaas-Nonce", "")
    signature = headers.get("X-Obrasaas-Signature", "")
    if not re.fullmatch(r"[0-9]{10}", timestamp) or not re.fullmatch(r"[a-f0-9]{32}", nonce) or not re.fullmatch(r"[a-f0-9]{64}", signature):
        raise BiometricError("BIOMETRIC_SERVICE_ACCESS_REQUIRED", 401)
    current = int(time.time() if now is None else now)
    if abs(current - int(timestamp)) > 30:
        raise BiometricError("BIOMETRIC_SERVICE_ACCESS_REQUIRED", 401)
    payload = b"obrasaas-biometric-v1\n" + timestamp.encode() + b"\n" + nonce.encode() + b"\n" + hashlib.sha256(raw).hexdigest().encode()
    expected = hmac.new(bytes.fromhex(secret), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise BiometricError("BIOMETRIC_SERVICE_ACCESS_REQUIRED", 401)


def image_input(value):
    if not isinstance(value, dict) or set(value) != {"data", "mimeType", "sha256"}:
        raise BiometricError("BIOMETRIC_IMAGE_INVALID")
    if value["mimeType"] not in {"image/jpeg", "image/png", "image/webp"} or not isinstance(value["sha256"], str) or not re.fullmatch(r"[a-f0-9]{64}", value["sha256"]):
        raise BiometricError("BIOMETRIC_IMAGE_INVALID")
    if not isinstance(value["data"], str) or len(value["data"]) > (MAX_IMAGE + 2) // 3 * 4:
        raise BiometricError("BIOMETRIC_IMAGE_INVALID")
    try:
        raw = base64.b64decode(value["data"], validate=True)
    except (ValueError, TypeError):
        raise BiometricError("BIOMETRIC_IMAGE_INVALID") from None
    if not raw or len(raw) > MAX_IMAGE or hashlib.sha256(raw).hexdigest() != value["sha256"]:
        raise BiometricError("BIOMETRIC_IMAGE_INTEGRITY")
    return raw


def decode_image(raw, mime_type):
    import cv2
    import numpy as np
    from PIL import Image, ImageOps
    try:
        with Image.open(io.BytesIO(raw)) as photo:
            expected = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[mime_type]
            width, height = photo.size
            if photo.format != expected or getattr(photo, "n_frames", 1) != 1 or min(width, height) < 80 or max(width, height) > 4096 or width * height > 12_000_000:
                raise BiometricError("BIOMETRIC_IMAGE_INVALID")
            photo = ImageOps.exif_transpose(photo).convert("RGB")
            image = cv2.cvtColor(np.asarray(photo), cv2.COLOR_RGB2BGR)
        if max(image.shape[:2]) > 1600:
            ratio = 1600 / max(image.shape[:2])
            image = cv2.resize(image, (round(image.shape[1] * ratio), round(image.shape[0] * ratio)))
        return image
    except BiometricError:
        raise
    except Exception:
        raise BiometricError("BIOMETRIC_IMAGE_INVALID") from None


def model_file(entry, directory):
    _, repository, revision, filename, expected = entry
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / filename
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == expected:
        return str(target)
    url = f"https://huggingface.co/{repository}/resolve/{revision}/{filename}"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=directory, suffix=".download", delete=False) as output:
            temporary = Path(output.name)
            digest = hashlib.sha256()
            total = 0
            with urllib.request.urlopen(url, timeout=15) as response:
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > 40 * 1024 * 1024:
                        raise BiometricError("BIOMETRIC_MODEL_UNAVAILABLE", 503)
                    digest.update(chunk)
                    output.write(chunk)
            if digest.hexdigest() != expected:
                raise BiometricError("BIOMETRIC_MODEL_INTEGRITY", 503)
        os.replace(temporary, target)
        return str(target)
    except BiometricError:
        raise
    except Exception:
        raise BiometricError("BIOMETRIC_MODEL_UNAVAILABLE", 503) from None
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def load_models(directory=None):
    global _models
    if _models is not None and directory is None:
        return _models
    import cv2
    import onnxruntime as ort
    directory = Path(directory or Path(tempfile.gettempdir()) / "obrasaas-biometric-models-v1")
    paths = [model_file(entry, directory) for entry in MODEL_MANIFEST]
    cv2.setNumThreads(1)
    detector = cv2.FaceDetectorYN.create(paths[0], "", (320, 320), 0.90, 0.3, 64)
    recognizer = cv2.FaceRecognizerSF.create(paths[1], "")
    options = ort.SessionOptions()
    options.intra_op_num_threads = options.inter_op_num_threads = 1
    options.log_severity_level = 3
    anti_spoof = ort.InferenceSession(paths[2], sess_options=options, providers=["CPUExecutionProvider"])
    models = detector, recognizer, anti_spoof
    if directory == Path(tempfile.gettempdir()) / "obrasaas-biometric-models-v1":
        _models = models
    return models


def load_quality_detector(directory=None):
    """Reuse only pinned YuNet; never load recognition/anti-spoofing for quality."""
    global _quality_detector
    if _quality_detector is not None and directory is None:
        return _quality_detector
    import cv2
    directory_path = Path(directory or Path(tempfile.gettempdir()) / "obrasaas-biometric-models-v1")
    model = model_file(MODEL_MANIFEST[0], directory_path)
    cv2.setNumThreads(1)
    detector = cv2.FaceDetectorYN.create(model, "", (320, 320), 0.90, 0.3, 64)
    if directory is None:
        _quality_detector = detector
    return detector


def _quality_result(payload, state, reasons):
    if state not in {"QUALITY_PASS", "RETAKE_REQUIRED", "UNCERTAIN"} or any(reason not in CAPTURE_QUALITY_REASONS for reason in reasons):
        raise BiometricError("CAPTURE_QUALITY_RESULT_UNCONFIRMED", 503)
    return {"version": 1, "mode": CAPTURE_QUALITY_MODE, "kind": payload["kind"], "state": state,
            "reasonCodes": list(dict.fromkeys(reasons)), "imageSha256": payload["image"]["sha256"],
            "modelManifestSha256": CAPTURE_QUALITY_MODEL_SHA, "identityCertified": False,
            "livenessVerified": False, "documentAuthenticityVerified": False}


def _capture_pixels(gray):
    """Conservative capture defects; these thresholds are not identity scores."""
    import cv2
    import numpy as np
    mean, spread = float(gray.mean()), float(gray.std())
    reasons = []
    if mean < 25 or float(np.mean(gray < 12)) > 0.90:
        reasons.append("IMAGE_TOO_DARK")
    if mean > 248 or float(np.mean(gray > 250)) > 0.98:
        reasons.append("IMAGE_TOO_BRIGHT")
    if spread < 7:
        reasons.append("IMAGE_LOW_CONTRAST")
    if float(cv2.Laplacian(gray, cv2.CV_64F).var()) < 12:
        reasons.append("IMAGE_BLURRED")
    return reasons


def _document_portrait(image, polygon, bounds, detector):
    """Confirm one usable printed portrait; never compare or identify its face."""
    import cv2
    import numpy as np
    x, y, box_w, box_h = bounds
    candidate = image[y:y + box_h, x:x + box_w]
    detector = detector if detector is not None else load_quality_detector()
    detector.setInputSize((box_w, box_h))
    _, faces = detector.detect(candidate)
    if faces is None or len(faces) != 1:
        return "RETAKE_REQUIRED", ["DOCUMENT_PORTRAIT_UNCONFIRMED"]
    detected = np.asarray(faces[0], dtype=float)
    if detected.ndim != 1 or detected.size != 15 or not np.isfinite(detected).all() or not 0.90 <= detected[-1] <= 1:
        return "UNCERTAIN", ["QUALITY_SERVICE_UNAVAILABLE"]
    face_x, face_y, face_w, face_h = (float(value) for value in detected[:4])
    # A printed portrait is smaller than a selfie. The 40px floor is checked
    # against public-face synthetic cards, independently of selfie area rules.
    if min(face_w, face_h) < 40 or face_x < 0 or face_y < 0 or face_x + face_w > box_w or face_y + face_h > box_h:
        return "RETAKE_REQUIRED", ["DOCUMENT_PORTRAIT_UNCONFIRMED"]
    margin = max(2, min(box_w, box_h) * 0.01)
    corners = ((face_x, face_y), (face_x + face_w, face_y),
               (face_x, face_y + face_h), (face_x + face_w, face_y + face_h))
    if any(cv2.pointPolygonTest(polygon, (x + px, y + py), True) < margin for px, py in corners):
        return "RETAKE_REQUIRED", ["DOCUMENT_PORTRAIT_UNCONFIRMED"]
    gray = cv2.cvtColor(candidate, cv2.COLOR_BGR2GRAY)
    portrait = gray[int(face_y):math.ceil(face_y + face_h), int(face_x):math.ceil(face_x + face_w)]
    if _capture_pixels(portrait):
        return "RETAKE_REQUIRED", ["DOCUMENT_PORTRAIT_UNCONFIRMED"]
    return "QUALITY_PASS", []


def _document_capture(image, require_portrait=False, detector=None):
    """Locate a card candidate and optional portrait, never classify a DNI."""
    import cv2
    height, width = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 120)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)))
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    candidates = []
    for contour in contours:
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue
        polygon = cv2.approxPolyDP(contour, 0.025 * perimeter, True)
        if len(polygon) != 4 or not cv2.isContourConvex(polygon):
            continue
        rectangle = cv2.minAreaRect(polygon)
        side_a, side_b = rectangle[1]
        if min(side_a, side_b) <= 0 or not 1.2 <= max(side_a, side_b) / min(side_a, side_b) <= 2.2:
            continue
        area = float(cv2.contourArea(polygon))
        if area < width * height * 0.04:
            continue
        x, y, box_w, box_h = cv2.boundingRect(polygon)
        candidates.append((area, x, y, box_w, box_h, polygon))
    if not candidates:
        return "UNCERTAIN", ["DOCUMENT_FRAME_UNCONFIRMED"]
    area, x, y, box_w, box_h, polygon = max(candidates, key=lambda value: value[0])
    if area < width * height * 0.18:
        return "RETAKE_REQUIRED", ["DOCUMENT_TOO_SMALL"]
    margin_x, margin_y = max(3, round(width * 0.015)), max(3, round(height * 0.015))
    if x <= margin_x or y <= margin_y or x + box_w >= width - margin_x or y + box_h >= height - margin_y:
        return "RETAKE_REQUIRED", ["DOCUMENT_OUT_OF_FRAME"]
    inset = max(2, round(min(box_w, box_h) * 0.025))
    crop = gray[y + inset:y + box_h - inset, x + inset:x + box_w - inset]
    reasons = _capture_pixels(crop)
    if reasons:
        return "RETAKE_REQUIRED", reasons
    if require_portrait:
        return _document_portrait(image, polygon, (x, y, box_w, box_h), detector)
    return "QUALITY_PASS", []


def evaluate_capture_quality(payload, detector=None):
    """Stateless pre-persistence quality only: no recognition, files or crops out."""
    if not isinstance(payload, dict) or set(payload) != {"version", "mode", "kind", "consentVersion", "image"} or type(payload.get("version")) is not int or payload["version"] != 1 or payload.get("mode") != CAPTURE_QUALITY_MODE or not isinstance(payload.get("kind"), str) or payload["kind"] not in CAPTURE_QUALITY_KINDS:
        raise BiometricError("CAPTURE_QUALITY_REQUEST_INVALID", 400)
    # This protocol label does not establish human consent; the application
    # verifies that consent and current authority before its signed request.
    if payload["consentVersion"] != CAPTURE_QUALITY_NOTICE:
        raise BiometricError("CAPTURE_QUALITY_PRIVACY_REQUIRED", 400)
    if not isinstance(payload["image"], dict) or not isinstance(payload["image"].get("mimeType"), str):
        raise BiometricError("CAPTURE_QUALITY_REQUEST_INVALID", 400)
    raw = image_input(payload["image"])
    try:
        image = decode_image(raw, payload["image"]["mimeType"])
    except BiometricError:
        return _quality_result(payload, "RETAKE_REQUIRED", ["IMAGE_DECODE_FAILED"])
    height, width = image.shape[:2]
    if min(width, height) < 320 or max(width, height) < 480:
        return _quality_result(payload, "RETAKE_REQUIRED", ["IMAGE_TOO_SMALL"])
    import cv2
    import numpy as np
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    reasons = _capture_pixels(gray)
    if reasons:
        return _quality_result(payload, "RETAKE_REQUIRED", reasons)
    if payload["kind"] != "SELFIE":
        try:
            state, reasons = _document_capture(image, require_portrait=payload["kind"] == "DOCUMENT_FRONT", detector=detector)
            return _quality_result(payload, state, reasons)
        except Exception:
            return _quality_result(payload, "UNCERTAIN", ["QUALITY_SERVICE_UNAVAILABLE"])
    try:
        detector = detector if detector is not None else load_quality_detector()
        detector.setInputSize((width, height))
        _, faces = detector.detect(image)
        if faces is None or len(faces) != 1:
            return _quality_result(payload, "RETAKE_REQUIRED", ["SINGLE_FACE_REQUIRED"])
        detected = np.asarray(faces[0], dtype=float)
        if detected.ndim != 1 or detected.size != 15 or not np.isfinite(detected).all() or not 0.90 <= detected[-1] <= 1:
            return _quality_result(payload, "UNCERTAIN", ["QUALITY_SERVICE_UNAVAILABLE"])
        x, y, face_w, face_h = (float(value) for value in detected[:4])
        margin_x, margin_y = max(3, width * 0.02), max(3, height * 0.02)
        if face_w <= 0 or face_h <= 0 or x < margin_x or y < margin_y or x + face_w > width - margin_x or y + face_h > height - margin_y:
            return _quality_result(payload, "RETAKE_REQUIRED", ["FACE_OUT_OF_FRAME"])
        if min(face_w, face_h) < 70 or face_w * face_h < width * height * 0.08:
            return _quality_result(payload, "RETAKE_REQUIRED", ["FACE_TOO_SMALL"])
        crop = gray[int(y):math.ceil(y + face_h), int(x):math.ceil(x + face_w)]
        reasons = _capture_pixels(crop)
        return _quality_result(payload, "RETAKE_REQUIRED" if reasons else "QUALITY_PASS", reasons)
    except Exception:
        return _quality_result(payload, "UNCERTAIN", ["QUALITY_SERVICE_UNAVAILABLE"])


def face(image, detector):
    import cv2
    height, width = image.shape[:2]
    detector.setInputSize((width, height))
    _, faces = detector.detect(image)
    if faces is None or len(faces) != 1:
        raise BiometricError("BIOMETRIC_SINGLE_FACE_REQUIRED")
    detected = faces[0]
    x, y, w, h = (float(v) for v in detected[:4])
    if min(w, h) < 40 or x < 0 or y < 0 or x + w > width or y + h > height:
        raise BiometricError("BIOMETRIC_FACE_QUALITY_REQUIRED")
    crop = image[max(0, int(y)):min(height, math.ceil(y+h)), max(0, int(x)):min(width, math.ceil(x+w))]
    if cv2.Laplacian(cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var() < 8:
        raise BiometricError("BIOMETRIC_FACE_QUALITY_REQUIRED")
    return detected


def passive_tensor(image, bbox):
    """Matches upstream 2.7 crop and ToTensor: BGR float 0..255, live index 1."""
    import cv2
    import numpy as np
    height, width = image.shape[:2]
    x, y, box_w, box_h = (float(v) for v in bbox[:4])
    scale = min((height - 1) / box_h, (width - 1) / box_w, 2.7)
    new_w, new_h = box_w * scale, box_h * scale
    left, top = x + box_w / 2 - new_w / 2, y + box_h / 2 - new_h / 2
    right, bottom = left + new_w, top + new_h
    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > width - 1:
        left -= right - width + 1
        right = width - 1
    if bottom > height - 1:
        top -= bottom - height + 1
        bottom = height - 1
    patch = image[int(top):int(bottom)+1, int(left):int(right)+1]
    return np.ascontiguousarray(cv2.resize(patch, (80, 80)).transpose((2, 0, 1))[None], dtype=np.float32)


def evaluate(payload, models=None):
    if not isinstance(payload, dict) or set(payload) != {"version", "consentVersion", "front", "selfie"} or type(payload["version"]) is not int or payload["version"] != 1 or not isinstance(payload["consentVersion"], str) or payload["consentVersion"] not in NOTICE_VERSIONS:
        raise BiometricError("BIOMETRIC_PRIVACY_REQUIRED", 400)
    front_raw, selfie_raw = image_input(payload["front"]), image_input(payload["selfie"])
    if payload["front"]["sha256"] == payload["selfie"]["sha256"]:
        raise BiometricError("BIOMETRIC_DISTINCT_CAPTURES_REQUIRED")
    front, selfie = decode_image(front_raw, payload["front"]["mimeType"]), decode_image(selfie_raw, payload["selfie"]["mimeType"])
    detector, recognizer, anti_spoof = models or load_models()
    # OpenCV objects are mutable; the HTTP handler serializes inference per process.
    front_face, selfie_face = face(front, detector), face(selfie, detector)
    front_feature = recognizer.feature(recognizer.alignCrop(front, front_face))
    selfie_feature = recognizer.feature(recognizer.alignCrop(selfie, selfie_face))
    import cv2
    import numpy as np
    similarity = float(recognizer.match(front_feature, selfie_feature, cv2.FaceRecognizerSF_FR_COSINE))
    logits = np.asarray(anti_spoof.run(None, {anti_spoof.get_inputs()[0].name: passive_tensor(selfie, selfie_face)})[0]).reshape(-1)
    if logits.shape != (3,) or not np.isfinite(logits).all() or not math.isfinite(similarity):
        raise BiometricError("BIOMETRIC_RESULT_UNCONFIRMED", 503)
    probability = np.exp(logits - logits.max())
    probability /= probability.sum()
    # No embedding, face crop, identity text or image is returned or persisted.
    return {"success": True, "status": "ADVISORY_UNREVIEWED", "faceSimilarity": round(max(-1, min(1, similarity)), 6), "captureRiskSignal": round(1-float(probability[1]), 6), "identityCertified": False, "livenessVerified": False, "documentAuthenticityVerified": False, "measurementCalibrated": False, "requiresHumanReview": True, "provider": "private-opencv-onnx", "modelManifestSha256": MANIFEST_SHA, "frontSha256": payload["front"]["sha256"], "selfieSha256": payload["selfie"]["sha256"]}
