from gmail_cron.ai import AiSuggestion
from gmail_cron.config import Account, AiSettings, Rule
from gmail_cron.organizer import Result, format_line_digest, format_result, organize_account


class Call:
    def __init__(self, value): self.value = value
    def execute(self): return self.value


class Labels:
    def list(self, **kwargs): return Call({"labels": [{"name": "Security", "id": "L1"}]})


class Messages:
    def __init__(self): self.modified = []; self.single_modified = []
    def list(self, **kwargs):
        if kwargs["q"] == "in:inbox newer_than:1d":
            return Call({"messages": [{"id": "m1"}, {"id": "m2"}]})
        return Call({"messages": [{"id": "m1"}]})
    def batchModify(self, **kwargs): self.modified.append(kwargs["body"]); return Call({})
    def get(self, **kwargs):
        return Call({"id": kwargs["id"], "snippet": "preview", "payload": {"headers": [
            {"name": "From", "value": "sender@example.com"}, {"name": "Subject", "value": "subject"}
        ]}})
    def modify(self, **kwargs): self.single_modified.append(kwargs); return Call({})


class Users:
    def __init__(self): self.message_api = Messages()
    def labels(self): return Labels()
    def messages(self): return self.message_api


class Service:
    def __init__(self): self.user_api = Users()
    def users(self): return self.user_api


ACCOUNT = Account("A", "a@example.com", "id", "secret", "token")


def test_dry_run_does_not_modify_messages():
    service = Service()
    result = organize_account(service, ACCOUNT, [Rule("Security", "from:google.com")], "1d", True)
    assert result.matched == {"Security": 1}
    assert service.user_api.message_api.modified == []


def test_archive_removes_inbox():
    service = Service()
    result = organize_account(service, ACCOUNT, [Rule("Security", "from:google.com", True)], "1d", False)
    assert result.archived == 1
    assert service.user_api.message_api.modified[0]["removeLabelIds"] == ["INBOX"]


def test_ai_only_receives_unmatched_messages_and_does_not_archive():
    class Classifier:
        def classify(self, previews):
            assert [preview.message_id for preview in previews] == ["m2"]
            return [AiSuggestion("m2", "Reading", 0.99, "一封電子報")]

    service = Service()
    ai = AiSettings("secret", "https://example.test", "glm", 0.9, 20, False)
    result = organize_account(
        service, ACCOUNT, [Rule("Security", "from:google.com")], "1d", False, ai=ai, classifier=Classifier()
    )

    assert result.ai_suggestions[0].category == "Reading"
    assert service.user_api.message_api.single_modified == []


def test_line_summary_can_include_email_without_changing_default_log_summary():
    result = Result(account="A", matched={"Security": 2})

    assert "a@example.com" in format_result(result, False, account_email="a@example.com")
    assert "a@example.com" not in format_result(result, False)


def test_line_summary_is_compact_and_limits_ai_items():
    result = Result(
        account="A",
        matched={"Security": 2, "Billing": 1, "Reading": 0},
        archived=3,
        ai_suggestions=[AiSuggestion(f"m{i}", "Other", 0.95, f"摘要 {i}") for i in range(7)],
    )
    text = format_result(result, False, account_email="a@example.com")

    assert "📬 Gmail A｜a@example.com" in text
    assert "🏷️ Security 2・Billing 1" in text
    assert "Reading" not in text
    assert "📥 已封存 3 封" in text
    assert "1. 【Other】摘要 0" in text
    assert "95%" not in text
    assert "摘要 5" not in text
    assert "…還有 2 封" in text


def test_line_digest_has_one_header_and_clear_account_separator():
    text = format_line_digest(["📬 Gmail A", "📬 Gmail B"], False)

    assert text.startswith("🧹 Gmail 每日整理\n================")
    assert text.count("━━━━━━━━") == 1


def test_ai_failure_does_not_stop_rule_based_organizing():
    class FailingClassifier:
        def classify(self, previews):
            raise TimeoutError("provider response containing private data")

    service = Service()
    ai = AiSettings("secret", "https://example.test", "glm", 0.9, 20, False)
    result = organize_account(
        service, ACCOUNT, [Rule("Security", "from:google.com")], "1d", False, ai=ai, classifier=FailingClassifier()
    )

    assert result.matched == {"Security": 1}
    assert result.ai_error == "TimeoutError"
    assert "provider response" not in format_result(result, False)
