import json

from gmail_cron.ai import AiSuggestion
from gmail_cron.config import Account, DashboardSettings
from gmail_cron.dashboard import publish_dashboard
from gmail_cron.organizer import Result


def test_dashboard_publish_excludes_message_ids_and_confidence():
    captured = {}
    account = Account("A", "a@example.com", "client", "secret", "refresh")
    result = Result(
        account="A",
        matched={"Security": 2},
        archived=1,
        ai_suggestions=[AiSuggestion("private-message-id", "Security", 0.98, "需要檢查登入")],
    )

    def post(url, headers, body):
        captured.update(url=url, headers=headers, payload=json.loads(body))

    publish_dashboard(
        DashboardSettings("https://dashboard.example", "ingest-secret"),
        [account],
        [result],
        False,
        post=post,
    )

    assert captured["url"] == "https://dashboard.example/api/digests"
    assert captured["headers"]["Authorization"] == "Bearer ingest-secret"
    serialized = json.dumps(captured["payload"])
    assert "private-message-id" not in serialized
    assert "0.98" not in serialized
    assert captured["payload"]["accounts"][0]["email"] == "a@example.com"
