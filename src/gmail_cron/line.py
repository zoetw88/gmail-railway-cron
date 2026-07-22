from __future__ import annotations

import json
from typing import Callable
from urllib.request import Request, urlopen

from .config import LineSettings


def _post(url: str, headers: dict[str, str], body: bytes) -> None:
    request = Request(url, data=body, headers=headers, method="POST")
    with urlopen(request, timeout=20) as response:
        if response.status != 200:
            raise RuntimeError(f"LINE push failed with HTTP {response.status}")


def push_line(settings: LineSettings, text: str, post: Callable = _post) -> None:
    payload = {"to": settings.user_id, "messages": [{"type": "text", "text": text[:5000]}]}
    post(
        "https://api.line.me/v2/bot/message/push",
        {"Authorization": f"Bearer {settings.channel_access_token}", "Content-Type": "application/json"},
        json.dumps(payload, ensure_ascii=False).encode(),
    )
