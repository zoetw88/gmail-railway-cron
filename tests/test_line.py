import json

from gmail_cron.config import LineSettings
from gmail_cron.line import push_line


def test_line_push_uses_messaging_api_and_truncates_text():
    captured = {}

    def post(url, headers, body):
        captured.update(url=url, headers=headers, payload=json.loads(body))

    push_line(LineSettings("token", "U" + "a" * 32), "文" * 5001, post=post)

    assert captured["url"] == "https://api.line.me/v2/bot/message/push"
    assert captured["headers"]["Authorization"] == "Bearer token"
    assert len(captured["payload"]["messages"][0]["text"]) == 5000
