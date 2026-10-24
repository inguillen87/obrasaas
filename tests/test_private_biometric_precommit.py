"""The v3 wire is checked separately from real-model accuracy and live service access."""
import base64
import hashlib
import io
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from PIL import Image

from api import _biometric_core as core


def image(seed):
    photo = Image.fromarray(np.random.default_rng(seed).integers(0, 256, (160, 160, 3), dtype=np.uint8))
    output = io.BytesIO()
    photo.save(output, format='JPEG')
    raw = output.getvalue()
    return {'data': base64.b64encode(raw).decode(), 'mimeType': 'image/jpeg', 'sha256': hashlib.sha256(raw).hexdigest()}


def payload(version='participant-private-biometric-v3'):
    return {'version': 1, 'consentVersion': version, 'front': image(1), 'selfie': image(2)}


class Recognizer:
    def alignCrop(self, frame, _face):
        return frame

    def feature(self, frame):
        return np.asarray([frame.mean()], dtype=np.float32)

    def match(self, _front, _selfie, _kind):
        return 0.4


class Passive:
    def get_inputs(self):
        return [SimpleNamespace(name='owned_synthetic_input')]

    def run(self, _outputs, _inputs):
        return [np.asarray([[0.1, 0.2, 0.3]], dtype=np.float32)]


class PrivateBiometricPrecommitTest(unittest.TestCase):
    def evaluate(self, body, recognizer=None):
        with patch.object(core, 'face', return_value=np.asarray([40, 40, 70, 70], dtype=np.float32)):
            return core.evaluate(body, models=(object(), recognizer or Recognizer(), Passive()))

    def test_v3_accepts_the_closed_wire_without_certifying_identity_or_returning_embeddings(self):
        body = payload()
        result = self.evaluate(body)
        self.assertEqual(set(result), {'success', 'status', 'faceSimilarity', 'captureRiskSignal', 'identityCertified', 'livenessVerified', 'documentAuthenticityVerified', 'measurementCalibrated', 'requiresHumanReview', 'provider', 'modelManifestSha256', 'frontSha256', 'selfieSha256'})
        self.assertTrue(result['success'])
        self.assertEqual(result['status'], 'ADVISORY_UNREVIEWED')
        self.assertTrue(result['requiresHumanReview'])
        for key in ['identityCertified', 'livenessVerified', 'documentAuthenticityVerified', 'measurementCalibrated']:
            self.assertFalse(result[key])
        self.assertEqual(result['frontSha256'], body['front']['sha256'])
        self.assertEqual(result['selfieSha256'], body['selfie']['sha256'])

    def test_v1_and_v2_keep_the_same_result_protocol(self):
        expected = self.evaluate(payload())
        for version in ['participant-private-biometric-v1', 'participant-private-biometric-v2']:
            self.assertEqual(self.evaluate(payload(version)), expected)

    def test_non_string_or_unknown_consent_is_controlled_before_loading_models(self):
        for version in [[], {}, None, True, 3, 'participant-private-biometric-v4']:
            with self.subTest(version=version), patch.object(core, 'load_models') as loader:
                with self.assertRaises(core.BiometricError) as error:
                    core.evaluate(payload(version))
                self.assertEqual(error.exception.code, 'BIOMETRIC_PRIVACY_REQUIRED')
                self.assertEqual(error.exception.status, 400)
                loader.assert_not_called()

    def test_extra_caller_authority_fields_are_rejected_before_model_loading(self):
        with patch.object(core, 'load_models') as loader:
            with self.assertRaises(core.BiometricError) as error:
                core.evaluate({**payload(), 'workerId': 'untrusted-caller'})
            self.assertEqual(error.exception.code, 'BIOMETRIC_PRIVACY_REQUIRED')
            loader.assert_not_called()

    def test_identical_captures_do_not_load_or_run_a_model(self):
        body = payload()
        body['selfie'] = dict(body['front'])
        with patch.object(core, 'load_models') as loader:
            with self.assertRaises(core.BiometricError) as error:
                core.evaluate(body)
            self.assertEqual(error.exception.code, 'BIOMETRIC_DISTINCT_CAPTURES_REQUIRED')
            loader.assert_not_called()

    def test_a_non_finite_model_value_is_not_accepted_as_advice(self):
        recognizer = Recognizer()
        recognizer.match = lambda *_args: float('nan')
        with self.assertRaises(core.BiometricError) as error:
            self.evaluate(payload(), recognizer)
        self.assertEqual(error.exception.code, 'BIOMETRIC_RESULT_UNCONFIRMED')
        self.assertEqual(error.exception.status, 503)


if __name__ == '__main__':
    unittest.main()
