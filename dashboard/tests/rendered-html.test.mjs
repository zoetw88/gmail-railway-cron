import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build emits the dashboard worker and removes starter preview content", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [page, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Inbox Daily/);
  assert.match(page, /使用 ChatGPT 登入/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("source keeps data minimization and server-side authorization explicit", async () => {
  const [page, route, publisher] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/digests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/gmail_cron/dashboard.py", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ALLOWED_VIEWER_EMAILS/);
  assert.match(page, /30 天後自動刪除/);
  assert.match(route, /request\.headers\.get\("x-ingest-token"\)/);
  assert.match(route, /DELETE FROM digest_runs/);
  assert.doesNotMatch(publisher, /message_id|confidence/);
});
