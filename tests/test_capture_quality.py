import base64
import hashlib
import hmac
import importlib.util
import io
import json
import pathlib
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from api._biometric_core import (
    BiometricError, CAPTURE_QUALITY_MODE, CAPTURE_QUALITY_MODEL_SHA,
    CAPTURE_QUALITY_NOTICE, CAPTURE_QUALITY_REASONS, MODEL_MANIFEST,
    decode_image, evaluate_capture_quality, load_quality_detector,
)


def image_entry(image):
    output = io.BytesIO()
    image.save(output, format="PNG")
    raw = output.getvalue()
    return {"data": base64.b64encode(raw).decode(), "mimeType": "image/png", "sha256": hashlib.sha256(raw).hexdigest()}


def payload(image=None, kind="SELFIE"):
    return {"version": 1, "mode": CAPTURE_QUALITY_MODE, "kind": kind,
            "consentVersion": CAPTURE_QUALITY_NOTICE,
            "image": image_entry(image if image is not None else textured_photo())}


def textured_photo():
    y, x = np.indices((480, 640))
    values = np.where(((x // 8 + y // 8) % 2) == 0, 85, 175).astype(np.uint8)
    return Image.fromarray(np.stack([values, values, values], axis=2))


def synthetic_card():
    image = Image.new("RGB", (800, 600), (65, 75, 85))
    draw = ImageDraw.Draw(image)
    draw.rectangle((115, 125, 685, 475), fill=(205, 215, 220), outline=(15, 15, 15), width=5)
    draw.rectangle((145, 175, 295, 405), fill=(105, 125, 140), outline=(40, 40, 40), width=3)
    for y in range(175, 410, 22):
        draw.line((325, y, 645, y), fill=(35, 40, 45), width=4)
    return image


def synthetic_card_with_portrait_detail():
    image = synthetic_card()
    image.paste(textured_photo().crop((0, 0, 150, 230)), (145, 175))
    return image


class Detector:
    def __init__(self, boxes):
        self.boxes, self.input_sizes, self.calls = boxes, [], 0

    def setInputSize(self, size):
        self.input_sizes.append(size)

    def detect(self, image):
        self.calls += 1
        rows = None if self.boxes is None else np.array([list(box) + [0] * 10 + [0.99] for box in self.boxes], dtype=float)
        return 1, rows


class CaptureQualityTest(unittest.TestCase):
    def assert_result(self, result, request, state):
        self.assertEqual(set(result), {"version", "mode", "kind", "state", "reasonCodes", "imageSha256", "modelManifestSha256", "identityCertified", "livenessVerified", "documentAuthenticityVerified"})
        self.assertEqual(result["version"], 1)
        self.assertEqual(result["mode"], CAPTURE_QUALITY_MODE)
        self.assertEqual(result["kind"], request["kind"])
        self.assertEqual(result["imageSha256"], request["image"]["sha256"])
        self.assertEqual(result["modelManifestSha256"], CAPTURE_QUALITY_MODEL_SHA)
        self.assertEqual(result["state"], state)
        self.assertTrue(set(result["reasonCodes"]) <= CAPTURE_QUALITY_REASONS)
        self.assertEqual(len(result["reasonCodes"]), len(set(result["reasonCodes"])))
        for name in ("identityCertified", "livenessVerified", "documentAuthenticityVerified"):
            self.assertIs(result[name], False)
        self.assertEqual(bool(result["reasonCodes"]), state != "QUALITY_PASS")

    def test_black_white_and_blurred_photos_fail_before_any_model(self):
        cases = [(Image.new("RGB", (640, 480), "black"), "IMAGE_TOO_DARK"),
                 (Image.new("RGB", (640, 480), "white"), "IMAGE_TOO_BRIGHT"),
                 (textured_photo().filter(ImageFilter.GaussianBlur(20)), "IMAGE_BLURRED")]
        with patch("api._biometric_core.load_quality_detector") as loader:
            for image, reason in cases:
                request = payload(image)
                result = evaluate_capture_quality(request)
                self.assert_result(result, request, "RETAKE_REQUIRED")
                self.assertIn(reason, result["reasonCodes"])
            loader.assert_not_called()

    def test_undecodable_and_tiny_images_cannot_pass(self):
        request = payload(Image.new("RGB", (120, 100), "gray"))
        result = evaluate_capture_quality(request)
        self.assert_result(result, request, "RETAKE_REQUIRED")
        self.assertEqual(result["reasonCodes"], ["IMAGE_TOO_SMALL"])
        raw = b"not an image"
        request["image"] = {"data": base64.b64encode(raw).decode(), "mimeType": "image/png", "sha256": hashlib.sha256(raw).hexdigest()}
        result = evaluate_capture_quality(request)
        self.assert_result(result, request, "RETAKE_REQUIRED")
        self.assertEqual(result["reasonCodes"], ["IMAGE_DECODE_FAILED"])

    def test_selfie_requires_one_uncropped_face_of_useful_size(self):
        request = payload()
        cases = [(None, "SINGLE_FACE_REQUIRED"), ([], "SINGLE_FACE_REQUIRED"),
                 ([(80, 80, 150, 180), (340, 80, 150, 180)], "SINGLE_FACE_REQUIRED"),
                 ([(0, 80, 210, 250)], "FACE_OUT_OF_FRAME"),
                 ([(450, 300, 210, 250)], "FACE_OUT_OF_FRAME"),
                 ([(260, 180, 45, 55)], "FACE_TOO_SMALL")]
        for boxes, reason in cases:
            detector = Detector(boxes)
            result = evaluate_capture_quality(request, detector=detector)
            self.assert_result(result, request, "RETAKE_REQUIRED")
            self.assertEqual(result["reasonCodes"], [reason])
            self.assertEqual(detector.input_sizes, [(640, 480)])

    def test_valid_capture_uses_only_injected_face_detector_without_identifying(self):
        request, detector = payload(), Detector([(210, 100, 220, 270)])
        # Warm the real decoder before forbidding file/network writes. The image
        # is entirely synthetic; injected boxes do not validate real inference.
        decode_image(base64.b64decode(request["image"]["data"]), "image/png")
        with patch("api._biometric_core.load_models") as paired, \
             patch("api._biometric_core.model_file") as model_file, \
             patch("api._biometric_core.tempfile.NamedTemporaryFile") as temporary, \
             patch("pathlib.Path.write_bytes") as writes, \
             patch("urllib.request.urlopen") as network:
            result = evaluate_capture_quality(request, detector=detector)
            self.assert_result(result, request, "QUALITY_PASS")
            for port in (paired, model_file, temporary, writes, network):
                port.assert_not_called()
        self.assertNotRegex(json.dumps(result), "embedding|faceSimilarity|captureRiskSignal|data|crop|text")

    def test_face_crop_defect_cannot_hide_behind_sharp_background(self):
        image = textured_photo()
        ImageDraw.Draw(image).rectangle((210, 100, 429, 369), fill=(120, 120, 120))
        request = payload(image)
        result = evaluate_capture_quality(request, detector=Detector([(210, 100, 220, 270)]))
        self.assert_result(result, request, "RETAKE_REQUIRED")
        self.assertIn("IMAGE_BLURRED", result["reasonCodes"])

    def test_document_back_geometry_does_not_claim_dni_type_or_require_face(self):
        with patch("api._biometric_core.load_quality_detector") as detector, patch("api._biometric_core.load_models") as paired:
            request = payload(synthetic_card(), "DOCUMENT_BACK")
            result = evaluate_capture_quality(request)
            self.assert_result(result, request, "QUALITY_PASS")
            detector.assert_not_called()
            paired.assert_not_called()

    def test_document_front_requires_one_usable_portrait_inside_card(self):
        request = payload(synthetic_card_with_portrait_detail(), "DOCUMENT_FRONT")
        cases = [None, [], [(40, 60, 80, 110), (180, 60, 80, 110)],
                 [(0, 60, 80, 110)], [(-10, 60, 80, 110)], [(60, 60, 25, 35)]]
        for boxes in cases:
            detector = Detector(boxes)
            result = evaluate_capture_quality(request, detector=detector)
            self.assert_result(result, request, "RETAKE_REQUIRED")
            self.assertEqual(result["reasonCodes"], ["DOCUMENT_PORTRAIT_UNCONFIRMED"])
            self.assertEqual(detector.calls, 1)
        # The rectangle still satisfies BACK geometry; portrait presence does
        # not classify either side or establish document authenticity.
        back = {**request, "kind": "DOCUMENT_BACK"}
        self.assert_result(evaluate_capture_quality(back), back, "QUALITY_PASS")

    def test_document_portrait_detail_has_own_floor_and_never_loads_identity_models(self):
        request = payload(synthetic_card_with_portrait_detail(), "DOCUMENT_FRONT")
        detector = Detector([(45, 70, 48, 70)])
        decode_image(base64.b64decode(request["image"]["data"]), "image/png")
        with patch("api._biometric_core.load_models") as paired, \
             patch("api._biometric_core.model_file") as model_file, \
             patch("api._biometric_core.tempfile.NamedTemporaryFile") as temporary, \
             patch("pathlib.Path.write_bytes") as writes, \
             patch("urllib.request.urlopen") as network:
            result = evaluate_capture_quality(request, detector=detector)
            self.assert_result(result, request, "QUALITY_PASS")
            for port in (paired, model_file, temporary, writes, network):
                port.assert_not_called()
        self.assertNotRegex(json.dumps(result), "embedding|faceSimilarity|captureRiskSignal|data|crop|text")
        flat = payload(synthetic_card(), "DOCUMENT_FRONT")
        result = evaluate_capture_quality(flat, detector=Detector([(45, 70, 48, 70)]))
        self.assert_result(result, flat, "RETAKE_REQUIRED")
        self.assertEqual(result["reasonCodes"], ["DOCUMENT_PORTRAIT_UNCONFIRMED"])

    def test_document_portrait_service_failure_and_malformed_output_stay_uncertain(self):
        request = payload(synthetic_card_with_portrait_detail(), "DOCUMENT_FRONT")
        with patch("api._biometric_core.load_quality_detector", side_effect=BiometricError("BIOMETRIC_MODEL_UNAVAILABLE", 503)):
            result = evaluate_capture_quality(request)
            self.assert_result(result, request, "UNCERTAIN")
            self.assertEqual(result["reasonCodes"], ["QUALITY_SERVICE_UNAVAILABLE"])
        result = evaluate_capture_quality(request, detector=Detector([(float("nan"), 60, 80, 110)]))
        self.assert_result(result, request, "UNCERTAIN")
        self.assertEqual(result["reasonCodes"], ["QUALITY_SERVICE_UNAVAILABLE"])

    def test_unconfirmed_document_frame_is_uncertain_and_not_accepted(self):
        noise = np.random.default_rng(42).integers(60, 190, size=(480, 640, 3), dtype=np.uint8)
        request = payload(Image.fromarray(noise), "DOCUMENT_BACK")
        result = evaluate_capture_quality(request)
        self.assert_result(result, request, "UNCERTAIN")
        self.assertEqual(result["reasonCodes"], ["DOCUMENT_FRAME_UNCONFIRMED"])

    def test_card_too_small_or_cropped_requires_retake(self):
        small = Image.new("RGB", (800, 600), (65, 75, 85))
        small.paste(synthetic_card().resize((320, 240)), (240, 180))
        request = payload(small, "DOCUMENT_FRONT")
        result = evaluate_capture_quality(request)
        self.assert_result(result, request, "RETAKE_REQUIRED")
        self.assertIn("DOCUMENT_TOO_SMALL", result["reasonCodes"])
        cropped = synthetic_card().crop((120, 125, 680, 475)).resize((800, 500))
        request = payload(cropped, "DOCUMENT_BACK")
        result = evaluate_capture_quality(request)
        self.assertNotEqual(result["state"], "QUALITY_PASS")

    def test_document_back_ignores_unrelated_out_of_frame_background_rectangle(self):
        # Pure synthetic geometry: no real document, portrait or identity model.
        image = synthetic_card()
        ImageDraw.Draw(image).rectangle((3, 3, 796, 596), outline=(245, 245, 245), width=4)
        request = payload(image, "DOCUMENT_BACK")
        with patch("api._biometric_core.load_quality_detector") as detector, \
             patch("api._biometric_core.load_models") as paired:
            result = evaluate_capture_quality(request)
            self.assert_result(result, request, "QUALITY_PASS")
            detector.assert_not_called()
            paired.assert_not_called()

    def test_document_front_ignores_unrelated_out_of_frame_background_rectangle(self):
        # Injected boxes test the existing printed-portrait gate, not real inference.
        image = synthetic_card_with_portrait_detail()
        ImageDraw.Draw(image).rectangle((3, 3, 796, 596), outline=(245, 245, 245), width=4)
        request, detector = payload(image, "DOCUMENT_FRONT"), Detector([(45, 70, 48, 70)])
        with patch("api._biometric_core.load_quality_detector") as loader, \
             patch("api._biometric_core.load_models") as paired:
            result = evaluate_capture_quality(request, detector=detector)
            self.assert_result(result, request, "QUALITY_PASS")
            self.assertEqual(detector.calls, 1)
            loader.assert_not_called()
            paired.assert_not_called()

    def test_background_rectangle_without_eligible_card_keeps_existing_rejection(self):
        empty = Image.new("RGB", (800, 600), (65, 75, 85))
        small = empty.copy()
        small.paste(synthetic_card().resize((320, 240)), (240, 180))
        for image in (empty, small):
            ImageDraw.Draw(image).rectangle((3, 3, 796, 596), outline=(245, 245, 245), width=4)
            request = payload(image, "DOCUMENT_BACK")
            result = evaluate_capture_quality(request)
            self.assert_result(result, request, "RETAKE_REQUIRED")
            self.assertEqual(result["reasonCodes"], ["DOCUMENT_OUT_OF_FRAME"])

    def test_service_failure_and_nonfinite_detector_output_are_uncertain(self):
        request = payload()
        with patch("api._biometric_core.load_quality_detector", side_effect=BiometricError("BIOMETRIC_MODEL_UNAVAILABLE", 503)):
            result = evaluate_capture_quality(request)
            self.assert_result(result, request, "UNCERTAIN")
            self.assertEqual(result["reasonCodes"], ["QUALITY_SERVICE_UNAVAILABLE"])
        result = evaluate_capture_quality(request, detector=Detector([(float("nan"), 80, 200, 250)]))
        self.assert_result(result, request, "UNCERTAIN")

    def test_strict_shape_kind_consent_hash_and_base64_before_model_load(self):
        request = payload()
        wrong = [{**request, "workerId": "forged"}, {**request, "version": True},
                 {**request, "mode": "other"}, {**request, "kind": "front"},
                 {**request, "kind": []}, {**request, "image": None},
                 {**request, "consentVersion": "participant-private-biometric-v2"},
                 {**request, "image": {**request["image"], "sha256": "0" * 64}},
                 {**request, "image": {**request["image"], "data": "broken"}},
                 {**request, "image": {**request["image"], "extra": True}},
                 {**request, "image": {**request["image"], "mimeType": []}},
                 {**request, "image": {**request["image"], "mimeType": "image/svg+xml"}}]
        with patch("api._biometric_core.load_quality_detector") as loader:
            for changed in wrong:
                with self.assertRaises(BiometricError):
                    evaluate_capture_quality(changed)
            loader.assert_not_called()

    def test_quality_loader_uses_only_pinned_yunet_and_keeps_separate_manifest(self):
        self.assertEqual(CAPTURE_QUALITY_MODEL_SHA, "49b52aefe0f0247ff19b0445af1ab173550163d701fd2a2dd7959289bbbd42e3")
        expected = object()
        directory = pathlib.Path("synthetic-model-directory-not-created")
        with patch("api._biometric_core.model_file", return_value="synthetic-yunet.onnx") as model_file, \
             patch("cv2.FaceDetectorYN.create", return_value=expected) as create, \
             patch("cv2.FaceRecognizerSF.create") as recognizer:
            self.assertIs(load_quality_detector(directory), expected)
            model_file.assert_called_once_with(MODEL_MANIFEST[0], directory)
            self.assertEqual(create.call_args.args[0], "synthetic-yunet.onnx")
            recognizer.assert_not_called()
        self.assertFalse(directory.exists())

    def test_same_hmac_endpoint_dispatches_quality_without_changing_pair_mode(self):
        path = pathlib.Path(__file__).resolve().parents[1] / "api/internal/biometric-analysis.py"
        spec = importlib.util.spec_from_file_location("private_quality_handler", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        server = HTTPServer(("127.0.0.1", 0), module.handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()

        def post(value):
            raw, secret = json.dumps(value, separators=(",", ":")).encode(), "7" * 64
            timestamp, nonce = str(int(time.time())), "a" * 32
            signed = b"obrasaas-biometric-v1\n" + timestamp.encode() + b"\n" + nonce.encode() + b"\n" + hashlib.sha256(raw).hexdigest().encode()
            headers = {"Content-Type": "application/json", "X-Obrasaas-Timestamp": timestamp,
                       "X-Obrasaas-Nonce": nonce, "X-Obrasaas-Signature": hmac.new(bytes.fromhex(secret), signed, hashlib.sha256).hexdigest()}
            return urllib.request.urlopen(urllib.request.Request(f"http://127.0.0.1:{server.server_port}", data=raw, headers=headers), timeout=2)

        try:
            with patch.dict("os.environ", {"OBRASAAS_BIOMETRIC_SERVICE_KEY": "7" * 64}), \
                 patch.object(module, "evaluate_capture_quality", return_value={"fixture": "quality"}) as quality, \
                 patch.object(module, "evaluate", return_value={"fixture": "pair"}) as paired:
                with post({"mode": CAPTURE_QUALITY_MODE}) as response:
                    self.assertEqual(json.loads(response.read()), {"fixture": "quality"})
                    self.assertEqual(response.headers.get("Cache-Control"), "no-store")
                quality.assert_called_once()
                paired.assert_not_called()
                with post({"version": 1}) as response:
                    self.assertEqual(json.loads(response.read()), {"fixture": "pair"})
                paired.assert_called_once()
            with patch.dict("os.environ", {"OBRASAAS_BIOMETRIC_SERVICE_KEY": "7" * 64}):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    post({"mode": "unknown"})
                self.assertEqual(error.exception.code, 400)
                self.assertEqual(json.loads(error.exception.read())["code"], "CAPTURE_QUALITY_REQUEST_INVALID")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
