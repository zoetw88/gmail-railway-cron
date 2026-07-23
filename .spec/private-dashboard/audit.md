# Audit

## Privacy

- Retained: account email, label counts, archive count, AI category and short summary, Gmail thread id, subject, and run timestamp.
- Excluded: sender addresses, snippets, bodies, OAuth credentials, AI and LINE keys.
- Retention: 30 days, enforced on every successful ingestion.
- Third parties: Railway sends the reduced summary payload to the Sites-hosted endpoint; Sites stores it in D1.
- Deletion: automatic after 30 days; full deletion can be performed by deleting the D1 rows or site.

## Security

- Viewer routes require ChatGPT sign-in and a server-side email allowlist.
- Ingestion requires a separate bearer secret and validates payload shape and size.
- Gmail links use the stored account email and validated thread id; they open Gmail directly and do not expose OAuth credentials.
- Secrets remain hosted environment variables and are never committed.
- The deployment must remain gated at the application layer if platform access is public for machine ingestion.

## Verification

- 2026-07-23: Railway production variables were present and the deployed source matched commit `0f8473b`.
- 2026-07-23: A production-configured manual run completed all four Gmail accounts and published the digest.
- 2026-07-23: The authenticated production dashboard rendered four account cards, 27 classifications, 5 archived messages, and 35 AI highlights.

## Blockers

- 2026-07-23: The Gmail-link version passed local build and tests, but the Sites deployment connector became unavailable before version save/deploy. Railway keeps a legacy-payload retry so scheduled ingestion remains operational until the site version can be published.
