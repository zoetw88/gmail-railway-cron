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
  const [page, route, publisher, push, subscriptions, viewerAccess, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/digests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/gmail_cron/dashboard.py", import.meta.url), "utf8"),
    readFile(new URL("../db/push.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/subscriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/viewer-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(viewerAccess, /ALLOWED_VIEWER_EMAILS/);
  assert.match(page, /30 天後自動刪除/);
  assert.match(route, /request\.headers\.get\("x-ingest-token"\)/);
  assert.match(route, /DELETE FROM digest_runs/);
  assert.match(page, /mail-link/);
  assert.match(page, /mail\.google\.com/);
  assert.match(page, /AI 緊急重點/);
  assert.match(page, /priority-\$\{priority\}/);
  assert.match(page, /category-badge/);
  assert.match(page, /combined-overview/);
  assert.match(page, /priority-columns/);
  assert.match(page, /account-chip/);
  assert.match(page, /urgent\.slice\(0, 12\)/);
  assert.match(page, /general\.slice\(0, 16\)/);
  assert.doesNotMatch(page, /className="timeline"/);
  assert.match(page, /每小時整點整理/);
  assert.match(route, /threadId/);
  assert.match(route, /priority/);
  assert.match(route, /aiLabelsApplied/);
  assert.match(publisher, /threadId/);
  assert.doesNotMatch(publisher, /confidence/);
  assert.match(push, /priority === "urgent"/);
  assert.match(push, /last_digest_id/);
  assert.doesNotMatch(push, /messageBody|rawBody|mailBody/);
  assert.match(subscriptions, /getAllowedViewer/);
  assert.match(subscriptions, /device limit reached/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(serviceWorker, /notificationclick/);
  assert.match(serviceWorker, /openWindow/);
});
