import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("build emits the dashboard worker and removes starter preview content", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [page, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Zoe Inbox/);
  assert.match(page, /使用 ChatGPT 登入/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("source keeps data minimization, accessible controls, and server-side authorization explicit", async () => {
  const [page, route, publisher, push, subscriptions, viewerAccess, organizeNow, organizeControl, notification, styles, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/digests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/gmail_cron/dashboard.py", import.meta.url), "utf8"),
    readFile(new URL("../db/push.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/push/subscriptions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/viewer-access.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/organize-now/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/organize-now-control.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/notification-control.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.match(viewerAccess, /ALLOWED_VIEWER_EMAILS/);
  assert.match(page, /摘要保留 30 天/);
  assert.match(route, /request\.headers\.get\("x-ingest-token"\)/);
  assert.match(route, /DELETE FROM digest_runs/);
  assert.match(page, /mail-link/);
  assert.match(page, /mail\.google\.com/);
  assert.match(page, /重點郵件/);
  assert.match(page, /priority-\$\{priority\}/);
  assert.match(page, /category-badge/);
  assert.match(page, /className="triage-feed"/);
  assert.match(page, /className="normal-disclosure"/);
  assert.match(page, /account-chip/);
  assert.doesNotMatch(page, /className="action-rail"/);
  assert.match(page, /<details className="source-disclosure"/);
  assert.match(page, /<details className="source-account"/);
  assert.doesNotMatch(page, /<details[^>]*\sopen/);
  assert.match(page, /urgent\.slice\(0, 12\)/);
  assert.match(page, /important\.slice\(0, 12\)/);
  assert.match(page, /normal\.slice\(0, 16\)/);
  assert.doesNotMatch(page, /className="timeline"/);
  assert.match(page, /每小時整點(?:自動)?整理/);
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
  assert.match(page, /OrganizeNowControl/);
  assert.match(organizeNow, /getAllowedViewer/);
  assert.match(organizeNow, /x-manual-run-token/);
  assert.match(organizeNow, /MANUAL_RUN_URL/);
  assert.match(organizeNow, /datetime\('now', '-5 minutes'\)/);
  assert.doesNotMatch(organizeNow, /request\.json/);
  assert.match(organizeControl, /POLL_INTERVAL_MS = 8_000/);
  assert.match(organizeControl, /POLL_TIMEOUT_MS = 180_000/);
  assert.match(organizeControl, /router\.refresh\(\)/);
  assert.match(organizeControl, /latestRunAt/);
  assert.match(organizeControl, /Date\.parse\(latestRunAt\)/);
  assert.match(organizeControl, /latestRunTimestamp >= requestedAt\.current - 5_000/);
  assert.match(organizeControl, /"processing"/);
  assert.match(organizeControl, /"completed"/);
  assert.match(organizeControl, /"delayed"/);
  assert.match(organizeControl, /state === "delayed" \? checkAgain : start/);
  assert.doesNotMatch(organizeControl, /const disabled =[^;\n]*state === "delayed"/);
  assert.match(organizeControl, /setCooldownUntil\(Date\.now\(\) \+ retryAfterSeconds \* 1_000\)/);
  assert.match(organizeControl, /clearInterval\(timer\)/);
  assert.match(organizeControl, /clearTimeout\(timer\)/);
  assert.match(page, /aria-label="郵件重點"/);
  assert.match(page, /aria-label="來源信箱"/);
  assert.match(notification, /aria-busy=/);
  assert.match(notification, /role="status"/);
  assert.match(notification, /aria-label=\{notificationAriaLabel\}/);
  assert.match(notification, /aria-pressed=/);
  assert.match(notification, /if \(!response\.ok\) throw new Error\("unsubscribe failed"\)/);
  assert.match(notification, /setTimeout\(\(\) => setMessage\(""\), 4_000\)/);
  assert.match(notification, /clearTimeout\(timer\)/);
  assert.match(styles, /summary:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(styles, /position:\s*(?:fixed|sticky)/);
});

test("verdict-first layout keeps empty urgency calm and mobile disclosures compact", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  const verdict = page.indexOf('id="verdict-title"');
  const triage = page.indexOf('className="triage-feed"');
  const sources = page.indexOf('className="source-section"');
  assert.ok(verdict >= 0 && verdict < triage && triage < sources);
  assert.match(page, /urgent\.length \? \(/);
  assert.match(page, /className="safe-line"/);
  assert.match(page, /目前沒有緊急郵件/);
  assert.match(page, /important\.length > 0/);
  assert.doesNotMatch(page, /ALL MAILBOXES|MAILBOX DETAILS|signal-dot/);
  assert.match(styles, /\.safe-line\s*\{[^}]*height:\s*48px/s);
  assert.match(styles, /\.source-account > summary\s*\{[^}]*height:\s*64px/s);
  assert.match(styles, /@media \(max-width: 479px\)[\s\S]*?\.source-account > summary\s*\{[^}]*height:\s*62px/s);
  assert.match(styles, /--muted:\s*#53605a/);
  assert.doesNotMatch(styles, /\.notification-note\s*\{[^}]*right:\s*-\d/s);
});
