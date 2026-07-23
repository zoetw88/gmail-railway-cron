# Audit

## Privacy

- Retained: account email, label counts, archive count, AI category and short summary, run timestamp.
- Excluded: Gmail message ids, sender addresses, full subjects, snippets, bodies, OAuth credentials, AI and LINE keys.
- Retention: 30 days, enforced on every successful ingestion.
- Third parties: Railway sends the reduced summary payload to the Sites-hosted endpoint; Sites stores it in D1.
- Deletion: automatic after 30 days; full deletion can be performed by deleting the D1 rows or site.

## Security

- Viewer routes require ChatGPT sign-in and a server-side email allowlist.
- Ingestion requires a separate bearer secret and validates payload shape and size.
- Secrets remain hosted environment variables and are never committed.
- The deployment must remain gated at the application layer if platform access is public for machine ingestion.

## Verification

- 2026-07-23: Railway production variables were present and the deployed source matched commit `0f8473b`.
- 2026-07-23: A production-configured manual run completed all four Gmail accounts and published the digest.
- 2026-07-23: The authenticated production dashboard rendered four account cards, 27 classifications, 5 archived messages, and 35 AI highlights.
