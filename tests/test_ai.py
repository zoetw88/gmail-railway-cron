import json

from gmail_cron.ai import EmailPreview, GlmClassifier
from gmail_cron.config import AiSettings


SETTINGS = AiSettings("secret", "https://example.test/v4", "glm-test", 0.9, 20, False)


def test_glm_classifier_sends_limited_preview_and_validates_output():
    captured = {}

    def post(url, headers, body):
        captured.update(url=url, headers=headers, payload=json.loads(body))
        content = {
            "results": [
                {"id": "m1", "category": "Security", "confidence": 0.98, "summary": "需要檢查登入"},
                {"id": "invented", "category": "Billing", "confidence": 1, "summary": "忽略"},
                {"id": "m1", "category": "Other", "confidence": 1, "summary": "重複"},
            ]
        }
        return {"choices": [{"message": {"content": json.dumps(content)}}]}

    preview = EmailPreview("m1", "sender@example.com", "Subject", "x" * 800)
    result = GlmClassifier(SETTINGS, post_json=post).classify([preview])

    assert result[0].category == "Security"
    assert len(result) == 1
    assert captured["url"] == "https://example.test/v4/chat/completions"
    prompt = captured["payload"]["messages"][1]["content"]
    assert "x" * 500 in prompt
    assert "x" * 501 not in prompt
    assert captured["payload"]["response_format"] == {"type": "json_object"}


def test_glm_classifier_skips_invalid_category_and_confidence():
    content = {"results": [
        {"id": "m1", "category": "Delete", "confidence": 1, "summary": "bad"},
        {"id": "m2", "category": "Reading", "confidence": 2, "summary": "bad"},
    ]}
    post = lambda *_: {"choices": [{"message": {"content": json.dumps(content)}}]}
    previews = [EmailPreview("m1", "", "", ""), EmailPreview("m2", "", "", "")]
    assert GlmClassifier(SETTINGS, post_json=post).classify(previews) == []
