import { bindings, initializeDatabase, type AccountDigest, type DigestRun } from "@/db/digests";

export const dynamic = "force-dynamic";

const MAX_ACCOUNTS = 10;
const MAX_SUGGESTIONS = 20;

function validAccount(value: unknown): value is AccountDigest {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AccountDigest>;
  return (
    typeof item.name === "string" && item.name.length <= 20 &&
    typeof item.email === "string" && item.email.length <= 254 &&
    typeof item.archived === "number" && item.archived >= 0 &&
    !!item.matched && typeof item.matched === "object" &&
    Array.isArray(item.aiSuggestions) && item.aiSuggestions.length <= MAX_SUGGESTIONS &&
    item.aiSuggestions.every((suggestion) =>
      typeof suggestion?.category === "string" && suggestion.category.length <= 40 &&
      typeof suggestion?.summary === "string" && suggestion.summary.length <= 160 &&
      typeof suggestion?.subject === "string" && suggestion.subject.length <= 300 &&
      typeof suggestion?.threadId === "string" &&
      /^[A-Za-z0-9_-]{1,128}$/.test(suggestion.threadId)
    ) &&
    (item.aiError === null || typeof item.aiError === "string")
  );
}

function validPayload(value: unknown): value is DigestRun {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<DigestRun>;
  return (
    typeof item.id === "string" && item.id.length <= 80 &&
    typeof item.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt)) &&
    typeof item.dryRun === "boolean" &&
    Array.isArray(item.accounts) && item.accounts.length > 0 &&
    item.accounts.length <= MAX_ACCOUNTS && item.accounts.every(validAccount)
  );
}

export async function POST(request: Request) {
  const { DB, INGEST_TOKEN } = bindings();
  const ingestToken = request.headers.get("x-ingest-token");
  if (!INGEST_TOKEN || ingestToken !== INGEST_TOKEN) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!DB) return Response.json({ error: "database unavailable" }, { status: 503 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!validPayload(payload)) {
    return Response.json({ error: "invalid payload" }, { status: 400 });
  }

  await initializeDatabase(DB);
  await DB.batch([
    DB.prepare(
      "INSERT OR REPLACE INTO digest_runs (id, created_at, dry_run, payload_json) VALUES (?, ?, ?, ?)",
    ).bind(payload.id, payload.createdAt, payload.dryRun ? 1 : 0, JSON.stringify(payload)),
    DB.prepare("DELETE FROM digest_runs WHERE created_at < datetime('now', '-30 days')"),
  ]);
  return Response.json({ ok: true }, { status: 201 });
}
