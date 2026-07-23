# Private dashboard acceptance criteria

- [x] Dashboard shows all configured Gmail accounts in a responsive layout.
- [x] Dashboard stores only category counts, archive counts, AI short summaries, and account addresses.
- [x] AI highlights show a subject link that opens the original thread in the matching Gmail account.
- [x] Anonymous viewers must sign in; only configured viewer emails may view data.
- [x] Railway can publish summaries through the Sites machine-bypass header and a separate ingestion secret.
- [x] Stored summaries older than 30 days are deleted during ingestion.
- [x] Production deployment succeeds with D1 and runtime secrets.
- [x] End-to-end smoke verifies Railway ingestion and authenticated dashboard rendering.
