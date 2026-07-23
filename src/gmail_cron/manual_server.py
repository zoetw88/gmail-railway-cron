from __future__ import annotations

import hmac
import json
import os
import subprocess
import sys
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


_run_lock = threading.Lock()
_running = False


def _run_all_mailboxes() -> None:
    global _running
    try:
        subprocess.run([sys.executable, "-m", "gmail_cron"], check=False)
    finally:
        with _run_lock:
            _running = False


class ManualRunHandler(BaseHTTPRequestHandler):
    server_version = "InboxDailyManual/1.0"

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        self._json(HTTPStatus.OK, {"ok": True, "running": _running})

    def do_POST(self) -> None:
        global _running
        if self.path != "/run":
            self._json(HTTPStatus.NOT_FOUND, {"error": "not found"})
            return
        expected = os.environ.get("MANUAL_RUN_TOKEN", "")
        supplied = self.headers.get("x-manual-run-token", "")
        if not expected or not hmac.compare_digest(supplied, expected):
            self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
            return
        with _run_lock:
            if _running:
                self._json(HTTPStatus.CONFLICT, {"error": "already running"})
                return
            _running = True
        threading.Thread(target=_run_all_mailboxes, daemon=True).start()
        self._json(HTTPStatus.ACCEPTED, {"ok": True})

    def log_message(self, format: str, *args: object) -> None:
        print(f"manual-server {self.address_string()} {format % args}", flush=True)

    def _json(self, status: HTTPStatus, payload: dict[str, object]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), ManualRunHandler)
    print(f"manual-server listening on {port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

