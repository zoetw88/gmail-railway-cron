from __future__ import annotations

import base64
from dataclasses import dataclass, field
from email.message import EmailMessage

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import Account, Rule

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


@dataclass
class Result:
    account: str
    matched: dict[str, int] = field(default_factory=dict)
    archived: int = 0


def build_service(account: Account):
    credentials = Credentials(
        token=None,
        refresh_token=account.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=account.client_id,
        client_secret=account.client_secret,
        scopes=SCOPES,
    )
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def ensure_label(service, label_name: str, existing: dict[str, str], dry_run: bool) -> str | None:
    if label_name in existing:
        return existing[label_name]
    if dry_run:
        return None
    created = service.users().labels().create(
        userId="me",
        body={"name": label_name, "labelListVisibility": "labelShow", "messageListVisibility": "show"},
    ).execute()
    existing[label_name] = created["id"]
    return created["id"]


def list_message_ids(service, query: str) -> list[str]:
    ids: list[str] = []
    page_token = None
    while True:
        response = service.users().messages().list(
            userId="me", q=query, pageToken=page_token, maxResults=500
        ).execute()
        ids.extend(message["id"] for message in response.get("messages", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            return ids


def organize_account(service, account: Account, rules: list[Rule], lookback: str, dry_run: bool) -> Result:
    labels_response = service.users().labels().list(userId="me").execute()
    labels = {label["name"]: label["id"] for label in labels_response.get("labels", [])}
    result = Result(account=account.name)
    handled: set[str] = set()

    for rule in rules:
        label_id = ensure_label(service, rule.label, labels, dry_run)
        query = f"in:inbox newer_than:{lookback} ({rule.query})"
        message_ids = [message_id for message_id in list_message_ids(service, query) if message_id not in handled]
        handled.update(message_ids)
        result.matched[rule.label] = len(message_ids)
        if rule.archive:
            result.archived += len(message_ids)
        if dry_run or not message_ids:
            continue
        body = {"ids": message_ids, "addLabelIds": [label_id]}
        if rule.archive:
            body["removeLabelIds"] = ["INBOX"]
        service.users().messages().batchModify(userId="me", body=body).execute()
    return result


def send_summary(service, account: Account, result: Result, dry_run: bool) -> None:
    if dry_run:
        return
    lines = [f"{label}: {count}" for label, count in result.matched.items()]
    lines.append(f"封存: {result.archived}")
    message = EmailMessage()
    message["To"] = account.email
    message["From"] = account.email
    message["Subject"] = f"Gmail {account.name} 每日整理摘要"
    message.set_content("\n".join(lines))
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()

