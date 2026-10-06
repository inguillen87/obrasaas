import base64
import hashlib
import hmac
import io
import importlib.util
import json
import pathlib
import threading
import unittest
import urllib.error
import urllib.request
from http.server import HTTPServer
from unittest.mock import patch

import numpy as np
from PIL import Image

from api._biometric_core import BiometricError, NOTICE_VERSION, authorize, decode_image, evaluate, image_input, passive_tensor


class PrivateBiometricTest(unittest.TestCase):
    def test_private_http_worker_rejects_browser_access_and_unsigned_requests(self):
        path = pathlib.Path(__file__).resolve().parents[1] / 'api/internal/biometric-analysis.py'
        spec = importlib.util.spec_from_file_location('private_biometric_handler', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        server = HTTPServer(('127.0.0.1', 0), module.handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        endpoint = f'http://127.0.0.1:{server.server_port}'
        try:
            with patch.dict('os.environ', {'OBRASAAS_BIOMETRIC_SERVICE_KEY': '7'*64}):
                for request, expected in [(urllib.request.Request(endpoint), 405), (urllib.request.Request(endpoint,data=b'{}',headers={'Content-Type':'application/json'}),401)]:
                    with self.assertRaises(urllib.error.HTTPError) as error:
                        urllib.request.urlopen(request, timeout=2)
                    self.assertEqual(error.exception.code, expected)
                    self.assertEqual(error.exception.headers.get('Cache-Control'), 'no-store')
                    self.assertNotIn('document', error.exception.read().decode())
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_signed_body_expiry_tamper_and_nonce(self):
        raw, secret = b'{"fixture":true}', '7' * 64
        digest = hashlib.sha256(raw).hexdigest()
        message = ('obrasaas-biometric-v1\n1791248000\n' + 'a'*32 + '\n' + digest).encode()
        headers = {'X-Obrasaas-Timestamp': '1791248000', 'X-Obrasaas-Nonce': 'a'*32, 'X-Obrasaas-Signature': hmac.new(bytes.fromhex(secret), message, hashlib.sha256).hexdigest()}
        authorize(raw, headers, secret, now=1791248000)
        for body, changes, at in [(raw+b'x', {}, 1791248000), (raw, {}, 1791248031), (raw, {'X-Obrasaas-Nonce': 'bad'}, 1791248000), (raw, {'X-Obrasaas-Signature': '0'*64}, 1791248000)]:
            with self.assertRaises(BiometricError):
                authorize(body, {**headers, **changes}, secret, now=at)

    def test_no_provider_without_separate_consent(self):
        with patch('api._biometric_core.load_models') as loader:
            with self.assertRaises(BiometricError):
                evaluate({'version': 1, 'consentVersion': 'old', 'front': {}, 'selfie': {}})
            loader.assert_not_called()

    def test_digest_mime_and_pixel_limits(self):
        output = io.BytesIO()
        Image.new('RGB', (120, 100), 'white').save(output, format='JPEG')
        raw = output.getvalue()
        entry = {'data': base64.b64encode(raw).decode(), 'mimeType': 'image/jpeg', 'sha256': hashlib.sha256(raw).hexdigest()}
        self.assertEqual(image_input(entry), raw)
        self.assertEqual(decode_image(raw, 'image/jpeg').shape, (100, 120, 3))
        for changed in [{**entry, 'sha256':'0'*64}, {**entry, 'data':'not base64'}, {**entry, 'mimeType':'image/svg+xml'}]:
            with self.assertRaises(BiometricError):
                image_input(changed)
        with self.assertRaises(BiometricError):
            decode_image(raw, 'image/png')
        with self.assertRaises(BiometricError):
            decode_image(b'broken', 'image/jpeg')
        with patch('api._biometric_core.load_models') as loader:
            with self.assertRaises(BiometricError):
                evaluate({'version':1,'consentVersion':NOTICE_VERSION,'front':entry,'selfie':entry})
            loader.assert_not_called()

    def test_upstream_passive_preprocessing_preserves_bgr_0_to_255(self):
        image = np.zeros((160, 120, 3), dtype=np.uint8)
        image[:,:,0], image[:,:,1], image[:,:,2] = 240, 120, 60
        tensor = passive_tensor(image, [25, 40, 50, 70])
        self.assertEqual(tensor.shape, (1, 3, 80, 80))
        self.assertEqual(tensor.dtype, np.float32)
        self.assertEqual(tensor[0,0,0,0], 240)
        self.assertEqual(tensor[0,2,0,0], 60)

    def test_unknown_input_rejected_before_model_load(self):
        with self.assertRaises(BiometricError):
            evaluate({'version':1,'consentVersion':NOTICE_VERSION,'front':{},'selfie':{},'workerId':'other-tenant'})


if __name__ == '__main__':
    unittest.main()
