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
from api._biometric_core import BiometricError, MANIFEST_SHA, NOTICE_VERSION, evaluate, load_models
from PIL import Image, ImageEnhance, ImageOps

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
    proof = {"actualModelInference": True, "provider": "private-opencv-onnx", "modelManifestSha256": MANIFEST_SHA, "publicSampleSourceRevision": REVISION, "customerDocumentsUsed": False, "productionInference": False, "humanAcceptance": False, "results": results}
    output = Path(".vercel/private/biometric-real-model-proof.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(proof, indent=2))
    print(json.dumps({"actualModelInference": True, "cases": len(results), "sourceHashesVerified": True, "humanAcceptance": False}))


if __name__ == "__main__":
    main()
