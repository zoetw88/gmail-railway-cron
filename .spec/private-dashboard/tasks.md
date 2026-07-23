# Private dashboard acceptance criteria

- [x] Dashboard shows all configured Gmail accounts in a responsive layout.
- [x] Dashboard stores only category counts, archive counts, AI short summaries, and account addresses.
- [x] Anonymous viewers must sign in; only configured viewer emails may view data.
- [x] Railway can publish summaries through a bearer-authenticated endpoint.
- [x] Stored summaries older than 30 days are deleted during ingestion.
- [ ] Production deployment succeeds with D1 and runtime secrets.
- [ ] End-to-end smoke verifies Railway ingestion and authenticated dashboard rendering.
