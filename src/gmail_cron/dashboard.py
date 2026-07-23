from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Callable
from urllib.request import Request, urlopen

from .config import Account, DashboardSettings
from .organizer import Result


def _post(url: str, headers: dict[str, str], body: bytes) -> None:
    request = Request(url, data=body, headers=headers, method="POST")
    with urlopen(request, timeout=20) as response:
        if response.status != 201:
            raise RuntimeError(f"dashboard publish failed with HTTP {response.status}")


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
                "aiSuggestions": [
                    {
                        "category": suggestion.category,
                        "summary": suggestion.summary,
                        "subject": suggestion.subject,
                        "threadId": suggestion.thread_id or suggestion.message_id,
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
    post(
        f"{settings.url}/api/digests",
        {
            "OAI-Sites-Authorization": f"Bearer {settings.access_token}",
            "X-Ingest-Token": settings.ingest_token,
            "Content-Type": "application/json",
        },
        json.dumps(dashboard_payload(accounts, results, dry_run), ensure_ascii=False).encode(),
    )
