from __future__ import annotations

import base64
from dataclasses import dataclass, field
from email.message import EmailMessage

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from .config import Account, Rule
from .ai import AiSuggestion, EmailPreview, GlmClassifier
from .config import AiSettings

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]

AI_LABEL_NAMES = {
    "Security": "安全/安全通知",
    "Billing": "財務/帳務",
    "Job Alerts": "工作/求職",
    "Reading": "閱讀/一般",
    "Courses": "學習/課程",
    "Promotions": "購物/促銷",
}


@dataclass
class Result:
    account: str
    matched: dict[str, int] = field(default_factory=dict)
    archived: int = 0
    ai_suggestions: list[AiSuggestion] = field(default_factory=list)
    ai_labels_applied: int = 0
    ai_error: str | None = None
    handled_message_ids: list[str] = field(default_factory=list, repr=False)


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


def _message_preview(service, message_id: str) -> EmailPreview:
    message = service.users().messages().get(
        userId="me", id=message_id, format="metadata", metadataHeaders=["From", "Subject"]
    ).execute()
    headers = {item["name"].lower(): item["value"] for item in message.get("payload", {}).get("headers", [])}
    return EmailPreview(
        message_id,
        headers.get("from", ""),
        headers.get("subject", ""),
        message.get("snippet", ""),
        message.get("threadId", message_id),
    )


def organize_account(
    service,
    account: Account,
    rules: list[Rule],
    lookback: str,
    dry_run: bool,
    ai: AiSettings | None = None,
    classifier: GlmClassifier | None = None,
    exclude_line_notified: bool = False,
) -> Result:
    labels_response = service.users().labels().list(userId="me").execute()
    labels = {label["name"]: label["id"] for label in labels_response.get("labels", [])}
    result = Result(account=account.name)
    handled: set[str] = set()

    for rule in rules:
        label_id = ensure_label(service, rule.label, labels, dry_run)
        notification_filter = ' -label:"Inbox Daily/已推送 LINE"' if exclude_line_notified else ""
        query = f"in:inbox newer_than:{lookback}{notification_filter} ({rule.query})"
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

    if ai:
        notification_filter = ' -label:"Inbox Daily/已推送 LINE"' if exclude_line_notified else ""
        all_ids = list_message_ids(service, f"in:inbox newer_than:{lookback}{notification_filter}")
        candidate_ids = [message_id for message_id in all_ids if message_id not in handled][: ai.max_messages]
        previews = [_message_preview(service, message_id) for message_id in candidate_ids]
        active_classifier = classifier or GlmClassifier(ai)
        try:
            result.ai_suggestions = active_classifier.classify(previews)
        except Exception as exc:
            # AI is optional. Record only the exception type so summaries stay useful
            # without leaking provider responses or message content.
            result.ai_error = type(exc).__name__
        if ai.apply_labels and not dry_run:
            for suggestion in result.ai_suggestions:
                if suggestion.confidence < ai.confidence_threshold or suggestion.category == "Other":
                    continue
                label_name = AI_LABEL_NAMES[suggestion.category]
                label_id = ensure_label(service, label_name, labels, dry_run=False)
                service.users().messages().modify(
                    userId="me", id=suggestion.message_id, body={"addLabelIds": [label_id]}
                ).execute()
                result.ai_labels_applied += 1
    result.handled_message_ids = sorted(handled | {item.message_id for item in result.ai_suggestions})
    return result


def mark_line_notified(service, result: Result) -> None:
    if not result.handled_message_ids:
        return
    labels_response = service.users().labels().list(userId="me").execute()
    labels = {label["name"]: label["id"] for label in labels_response.get("labels", [])}
    label_id = ensure_label(service, "Inbox Daily/已推送 LINE", labels, dry_run=False)
    for start in range(0, len(result.handled_message_ids), 1000):
        service.users().messages().batchModify(
            userId="me",
            body={
                "ids": result.handled_message_ids[start : start + 1000],
                "addLabelIds": [label_id],
            },
        ).execute()


def send_summary(service, account: Account, result: Result, dry_run: bool) -> None:
    if dry_run:
        return
    lines = [f"{label}: {count}" for label, count in result.matched.items()]
    lines.append(f"封存: {result.archived}")
    for suggestion in result.ai_suggestions:
        lines.append(f"AI {suggestion.category} ({suggestion.confidence:.0%}): {suggestion.summary}")
    if result.ai_error:
        lines.append(f"AI 暫時無法使用（{result.ai_error}），規則整理已照常完成")
    message = EmailMessage()
    message["To"] = account.email
    message["From"] = account.email
    message["Subject"] = f"Gmail {account.name} 每日整理摘要"
    message.set_content("\n".join(lines))
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()


def format_result(result: Result, dry_run: bool, account_email: str | None = None) -> str:
    mode = " · 測試" if dry_run else ""
    account_label = f"{result.account}｜{account_email}" if account_email else result.account
    lines = [f"📬 Gmail {account_label}{mode}"]
    counts = [f"{label} {count}" for label, count in result.matched.items() if count]
    lines.append("🏷️ " + ("・".join(counts) if counts else "無規則分類"))
    lines.append(f"📥 已封存 {result.archived} 封")
    if result.ai_suggestions:
        lines.extend(["", "✨ AI 重點"])
        lines.extend(
            f"{index}. 【{item.category}】{item.summary}"
            for index, item in enumerate(result.ai_suggestions[:5], start=1)
        )
        remaining = len(result.ai_suggestions) - 5
        if remaining > 0:
            lines.append(f"…還有 {remaining} 封")
    if result.ai_error:
        lines.extend(["", f"⚠️ AI 暫時無法使用（{result.ai_error}）", "規則整理已照常完成"])
    return "\n".join(lines)


def format_line_digest(summaries: list[str], dry_run: bool) -> str:
    title = "🧹 Gmail 每日整理"
    if dry_run:
        title += "｜測試模式"
    return f"{title}\n{'=' * 16}\n\n" + "\n\n━━━━━━━━\n\n".join(summaries)


def format_priority_line_digest(results: list[Result], dry_run: bool) -> str:
    title = "📮 Inbox Daily｜每小時整理"
    if dry_run:
        title += "（測試）"
    suggestions = [
        (result.account, suggestion)
        for result in results
        for suggestion in result.ai_suggestions
    ]
    urgent = [(account, item) for account, item in suggestions if item.priority == "urgent"]
    general = [(account, item) for account, item in suggestions if item.priority != "urgent"]
    lines = [title, "━━━━━━━━━━━━", "", f"🔴 需要先處理 {len(urgent)} 封"]
    lines.extend(f"• Gmail {account}｜{item.summary}" for account, item in urgent[:5])
    if not urgent:
        lines.append("目前沒有緊急郵件")
    lines.extend(["", f"🟢 重要與一般 {len(general)} 封"])
    lines.extend(f"• Gmail {account}｜{item.summary}" for account, item in general[:8])
    if not general:
        lines.append("這次沒有其他摘要")
    remaining = max(0, len(urgent) - 5) + max(0, len(general) - 8)
    if remaining:
        lines.extend(["", f"另有 {remaining} 封，請到 Inbox Daily 查看"])
    return "\n".join(lines)
