from gmail_cron.config import Account, Rule
from gmail_cron.organizer import organize_account


class Call:
    def __init__(self, value): self.value = value
    def execute(self): return self.value


class Labels:
    def list(self, **kwargs): return Call({"labels": [{"name": "Security", "id": "L1"}]})


class Messages:
    def __init__(self): self.modified = []
    def list(self, **kwargs): return Call({"messages": [{"id": "m1"}]})
    def batchModify(self, **kwargs): self.modified.append(kwargs["body"]); return Call({})


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

