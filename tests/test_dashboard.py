import json

from gmail_cron.ai import AiSuggestion
from gmail_cron.config import Account, DashboardSettings
from gmail_cron.dashboard import DashboardPublishError, publish_dashboard
from gmail_cron.organizer import Result


def test_dashboard_publish_includes_safe_gmail_link_data_but_excludes_confidence():
    captured = {}
    account = Account("A", "a@example.com", "client", "secret", "refresh")
    result = Result(
        account="A",
        matched={"Security": 2},
        archived=1,
        ai_suggestions=[
            AiSuggestion(
                "private-message-id",
                "Security",
                0.98,
                "需要檢查登入",
                "新的登入活動",
                "thread-123",
            )
        ],
    )

    def post(url, headers, body):
        captured.update(url=url, headers=headers, payload=json.loads(body))

    publish_dashboard(
        DashboardSettings("https://dashboard.example", "ingest-secret", "access-secret"),
        [account],
        [result],
        False,
        post=post,
    )

    assert captured["url"] == "https://dashboard.example/api/digests"
    assert captured["headers"]["OAI-Sites-Authorization"] == "Bearer access-secret"
    assert captured["headers"]["X-Ingest-Token"] == "ingest-secret"
    serialized = json.dumps(captured["payload"])
    assert "0.98" not in serialized
    assert captured["payload"]["accounts"][0]["email"] == "a@example.com"
    suggestion = captured["payload"]["accounts"][0]["aiSuggestions"][0]
    assert suggestion["subject"] == "新的登入活動"
    assert suggestion["threadId"] == "thread-123"
    assert suggestion["priority"] == "normal"
    assert captured["payload"]["accounts"][0]["aiLabelsApplied"] == 0
    assert "private-message-id" not in serialized


def test_dashboard_publish_retries_legacy_payload_when_old_site_rejects_link_fields():
    bodies = []
    account = Account("A", "a@example.com", "client", "secret", "refresh")
    result = Result(
        account="A",
        ai_suggestions=[AiSuggestion("m1", "Security", 0.98, "摘要", "主旨", "thread-1")],
    )

    def post(_url, _headers, body):
        bodies.append(json.loads(body))
        if len(bodies) == 1:
            raise DashboardPublishError(400)

    publish_dashboard(
        DashboardSettings("https://dashboard.example", "ingest-secret", "access-secret"),
        [account],
        [result],
        False,
        post=post,
    )

    assert bodies[0]["accounts"][0]["aiSuggestions"][0]["threadId"] == "thread-1"
    assert bodies[1]["accounts"][0]["aiSuggestions"][0] == {
        "category": "Security",
        "summary": "摘要",
    }
    assert "aiLabelsApplied" not in bodies[1]["accounts"][0]
