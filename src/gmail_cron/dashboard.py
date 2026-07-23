from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Callable
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .config import Account, DashboardSettings
from .organizer import Result


class DashboardPublishError(RuntimeError):
    def __init__(self, status: int):
        super().__init__(f"dashboard publish failed with HTTP {status}")
        self.status = status


def _post(url: str, headers: dict[str, str], body: bytes) -> None:
    request = Request(url, data=body, headers=headers, method="POST")
    try:
        with urlopen(request, timeout=20) as response:
            if response.status != 201:
                raise DashboardPublishError(response.status)
    except HTTPError as exc:
        raise DashboardPublishError(exc.code) from exc


def dashboard_payload(accounts: list[Account], results: list[Result], dry_run: bool) -> dict:
    created_at = datetime.now(timezone.utc).isoformat()
    account_by_name = {account.name: account for account in accounts}
    return {
        "id": created_at,
        "createdAt": created_at,
        "dryRun": dry_run,
        "accounts": [
            {
                "name": result.account,
                "email": account_by_name[result.account].email,
                "matched": result.matched,
                "archived": result.archived,
                "aiLabelsApplied": result.ai_labels_applied,
                "aiSuggestions": [
                    {
                        "category": suggestion.category,
                        "summary": suggestion.summary,
                        "subject": suggestion.subject,
                        "threadId": suggestion.thread_id or suggestion.message_id,
                        "priority": suggestion.priority,
                    }
                    for suggestion in result.ai_suggestions
                ],
                "aiError": result.ai_error,
            }
            for result in results
        ],
    }


def publish_dashboard(
    settings: DashboardSettings,
    accounts: list[Account],
    results: list[Result],
    dry_run: bool,
    post: Callable = _post,
) -> None:
    url = f"{settings.url}/api/digests"
    headers = {
        "OAI-Sites-Authorization": f"Bearer {settings.access_token}",
        "X-Ingest-Token": settings.ingest_token,
        "Content-Type": "application/json",
    }
    payload = dashboard_payload(accounts, results, dry_run)
    try:
        post(url, headers, json.dumps(payload, ensure_ascii=False).encode())
    except DashboardPublishError as exc:
        if exc.status != 400:
            raise
        legacy_payload = json.loads(json.dumps(payload))
        for account in legacy_payload["accounts"]:
            account.pop("aiLabelsApplied", None)
            for suggestion in account["aiSuggestions"]:
                suggestion.pop("subject", None)
                suggestion.pop("threadId", None)
                suggestion.pop("priority", None)
        post(url, headers, json.dumps(legacy_payload, ensure_ascii=False).encode())
