import json
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

import gmail_cron.manual_server as manual_server


def request(server: ThreadingHTTPServer, method: str, path: str, token: str | None = None):
    connection = HTTPConnection("127.0.0.1", server.server_port, timeout=2)
    headers = {"x-manual-run-token": token} if token else {}
    connection.request(method, path, headers=headers)
    response = connection.getresponse()
    payload = json.loads(response.read())
    connection.close()
    return response.status, payload


def test_manual_server_requires_token_and_starts_one_run(monkeypatch):
    started = threading.Event()
    release = threading.Event()

    def fake_run():
        started.set()
        release.wait(timeout=2)
        with manual_server._run_lock:
            manual_server._running = False

    monkeypatch.setenv("MANUAL_RUN_TOKEN", "test-secret")
    monkeypatch.setattr(manual_server, "_run_all_mailboxes", fake_run)
    manual_server._running = False
    server = ThreadingHTTPServer(("127.0.0.1", 0), manual_server.ManualRunHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        assert request(server, "POST", "/run")[0] == 401
        assert request(server, "POST", "/run", "test-secret")[0] == 202
        assert started.wait(timeout=1)
        assert request(server, "POST", "/run", "test-secret")[0] == 409
        status, payload = request(server, "GET", "/health")
        assert status == 200
        assert payload == {"ok": True, "running": True}
    finally:
        release.set()
        server.shutdown()
        server.server_close()

