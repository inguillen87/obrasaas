"""Internal authenticated CPU inference; business permissions stay in participant-store."""
import json
import os
import threading
from http.server import BaseHTTPRequestHandler

from api._biometric_core import MAX_BODY, BiometricError, authorize, evaluate

_inference_lock = threading.Lock()


class handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        # HTTP bodies and identity images must never enter application logs.
        return

    def respond(self, status, value):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(json.dumps(value, separators=(",", ":")).encode())

    def do_GET(self):
        self.respond(405, {"code": "METHOD_NOT_ALLOWED"})

    def do_POST(self):
        try:
            if self.headers.get_content_type() != "application/json" or self.headers.get("Transfer-Encoding"):
                raise BiometricError("BIOMETRIC_REQUEST_INVALID", 400)
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                raise BiometricError("BIOMETRIC_REQUEST_INVALID", 413)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise BiometricError("BIOMETRIC_REQUEST_INVALID", 400)
            authorize(raw, self.headers, os.environ.get("OBRASAAS_BIOMETRIC_SERVICE_KEY"))
            value = json.loads(raw)
            if not _inference_lock.acquire(timeout=2):
                raise BiometricError("BIOMETRIC_SERVICE_BUSY", 503)
            try:
                result = evaluate(value)
            finally:
                _inference_lock.release()
            self.respond(200, result)
        except BiometricError as error:
            self.respond(error.status, {"success": False, "code": error.code})
        except (ValueError, TypeError, json.JSONDecodeError):
            self.respond(400, {"success": False, "code": "BIOMETRIC_REQUEST_INVALID"})
        except Exception:
            self.respond(503, {"success": False, "code": "BIOMETRIC_RESULT_UNCONFIRMED"})
