"""Real CPU inference on pinned PUBLIC upstream samples, never customer documents."""
import base64
import hashlib
import io
import json
import sys
import tempfile
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api._biometric_core import (BiometricError, MANIFEST_SHA, NOTICE_VERSION, evaluate, load_models,
                                CAPTURE_QUALITY_MODE, CAPTURE_QUALITY_NOTICE, CAPTURE_QUALITY_MODEL_SHA,
                                decode_image, evaluate_capture_quality, load_quality_detector)
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

REVISION = "b6d5f04ad78778917853b25c778acef6d5626d15"
SAMPLES = {"image_T1.jpg": "f4455149f488f76205fdee5499ec5261d08ef6279a1cff7b778ea85405331e94", "image_F1.jpg": "4b11b5d7a8a8e4a88f5f16a5426a0a7692e39e5bb45bb03b4ebe5e1606336860", "image_F2.jpg": "fbbea73450ae9d9bb555c8ccac77bf39d234261fe3be4190e3ed2999690c485f"}


def sample(name):
    url = f"https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/{REVISION}/images/sample/{name}"
    with urllib.request.urlopen(url, timeout=15) as response:
        raw = response.read(500001)
    assert len(raw) <= 500000 and hashlib.sha256(raw).hexdigest() == SAMPLES[name], "PUBLIC_SAMPLE_INTEGRITY_REQUIRED"
    return raw


def pack(raw):
    return {"data": base64.b64encode(raw).decode(), "mimeType": "image/jpeg", "sha256": hashlib.sha256(raw).hexdigest()}


def quality_payload(photo, kind="SELFIE"):
    output = io.BytesIO()
    photo.save(output, format="JPEG", quality=95)
    return {"version": 1, "mode": CAPTURE_QUALITY_MODE, "kind": kind,
            "consentVersion": CAPTURE_QUALITY_NOTICE, "image": pack(output.getvalue())}


def capture_quality_cases(front, detector):
    results = []
    original = {"version": 1, "mode": CAPTURE_QUALITY_MODE, "kind": "SELFIE",
                "consentVersion": CAPTURE_QUALITY_NOTICE, "image": pack(front)}

    def check(name, request, expected_state=None, reason=None):
        result = evaluate_capture_quality(request, detector=detector)
        assert result["imageSha256"] == request["image"]["sha256"]
        assert result["modelManifestSha256"] == CAPTURE_QUALITY_MODEL_SHA
        assert result["identityCertified"] is False and result["livenessVerified"] is False and result["documentAuthenticityVerified"] is False
        if expected_state is not None:
            assert result["state"] == expected_state, name + ": " + result["state"]
        if reason is not None:
            assert reason in result["reasonCodes"], name + ": " + str(result["reasonCodes"])
        results.append({"case": name, "result": result})
        return result

    # Keep the original public sample unchanged. A retake is evidence of the
    # quality rule, never relabelled as a successful real selfie capture.
    original_result = check("original_public_sample_selfie_quality", original, "QUALITY_PASS")
    photo = ImageOps.exif_transpose(Image.open(io.BytesIO(front))).convert("RGB")
    blurred = photo.filter(ImageFilter.GaussianBlur(20))
    check("public_sample_heavily_blurred", quality_payload(blurred), "RETAKE_REQUIRED", "IMAGE_BLURRED")

    decoded = decode_image(front, "image/jpeg")
    detector.setInputSize((decoded.shape[1], decoded.shape[0]))
    _, detections = detector.detect(decoded)
    assert detections is not None and len(detections) == 1, "PUBLIC_QUALITY_FIXTURE_REQUIRES_ONE_DETECTED_FACE"
    # Derive a no-face negative without retaining the decoded image or crop.
    # YuNet boxes are only transient geometry, never identity information.
    no_face = Image.fromarray(decoded[:, :, ::-1])
    draw = ImageDraw.Draw(no_face)
    x, y, width, height = (float(value) for value in detections[0][:4])
    draw.rectangle((max(0, int(x - 40)), max(0, int(y - 40)), min(no_face.width, int(x + width + 40)), min(no_face.height, int(y + height + 40))), fill=(128, 128, 128))
    check("public_sample_face_removed", quality_payload(no_face), "RETAKE_REQUIRED", "SINGLE_FACE_REQUIRED")

    tile = Image.fromarray(decoded[:, :, ::-1])
    tile.thumbnail((1000, 1000))
    multiple = Image.new("RGB", (tile.width * 2, tile.height), (128, 128, 128))
    multiple.paste(tile, (0, 0))
    multiple.paste(tile, (tile.width, 0))
    check("public_sample_two_face_collage", quality_payload(multiple), "RETAKE_REQUIRED", "SINGLE_FACE_REQUIRED")

    # Card geometry is synthetic and cannot establish document type or side.
    card = Image.new("RGB", (800, 600), (65, 75, 85))
    draw = ImageDraw.Draw(card)
    draw.rectangle((115, 125, 685, 475), fill=(205, 215, 220), outline=(15, 15, 15), width=5)
    draw.rectangle((145, 175, 295, 405), fill=(105, 125, 140), outline=(40, 40, 40), width=3)
    for line_y in range(175, 410, 22):
        draw.line((325, line_y, 645, line_y), fill=(35, 40, 45), width=4)
    for kind in ("DOCUMENT_FRONT", "DOCUMENT_BACK"):
        check("synthetic_card_geometry_" + kind.lower(), quality_payload(card, kind), "QUALITY_PASS")
    check("synthetic_card_heavily_blurred", quality_payload(card.filter(ImageFilter.GaussianBlur(20)), "DOCUMENT_FRONT"), "RETAKE_REQUIRED", "IMAGE_BLURRED")
    check("synthetic_empty_document", quality_payload(Image.new("RGB", (800, 600), "white"), "DOCUMENT_BACK"), "RETAKE_REQUIRED", "IMAGE_TOO_BRIGHT")
    return results, original_result["state"] == "QUALITY_PASS"


def main():
    front = sample("image_T1.jpg")
    transformed = io.BytesIO()
    ImageEnhance.Brightness(ImageOps.exif_transpose(Image.open(io.BytesIO(front)))).enhance(0.96).save(transformed, format="JPEG", quality=95)
    results = []
    with tempfile.TemporaryDirectory(prefix="obrasaas-public-biometric-test-") as directory:
        models = load_models(Path(directory))
        result = evaluate({"version": 1, "consentVersion": NOTICE_VERSION, "front": pack(front), "selfie": pack(transformed.getvalue())}, models)
        assert result["faceSimilarity"] > 0.99
        assert result["identityCertified"] is False and result["livenessVerified"] is False
        results.append({"case": "same_public_reference_face_transformed", "result": result})
        for name in ["image_F1.jpg", "image_F2.jpg"]:
            try:
                result = evaluate({"version": 1, "consentVersion": NOTICE_VERSION, "front": pack(front), "selfie": pack(sample(name))}, models)
                assert result["identityCertified"] is False and result["livenessVerified"] is False
                results.append({"case": name, "result": result})
            except BiometricError as error:
                assert error.code in {"BIOMETRIC_SINGLE_FACE_REQUIRED", "BIOMETRIC_FACE_QUALITY_REQUIRED"}
                results.append({"case": name, "safeRejection": error.code})
        quality_results, original_selfie_passed = capture_quality_cases(front, load_quality_detector(Path(directory)))
    proof = {"actualModelInference": True, "provider": "private-opencv-onnx", "modelManifestSha256": MANIFEST_SHA, "publicSampleSourceRevision": REVISION, "customerDocumentsUsed": False, "productionInference": False, "humanAcceptance": False, "results": results,
             "captureQuality": {"mode": CAPTURE_QUALITY_MODE, "modelManifestSha256": CAPTURE_QUALITY_MODEL_SHA, "actualYuNetInference": True, "originalPublicSelfiePassed": original_selfie_passed, "documentClassifierVerified": False, "customerDocumentsUsed": False, "productionInference": False, "results": quality_results}}
    output = Path(".vercel/private/biometric-real-model-proof.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(proof, indent=2))
    print(json.dumps({"actualModelInference": True, "cases": len(results), "captureQualityCases": len(quality_results), "originalPublicSelfiePassed": original_selfie_passed, "documentClassifierVerified": False, "sourceHashesVerified": True, "humanAcceptance": False}))


if __name__ == "__main__":
    main()
