import { getAllowedViewer } from "@/app/viewer-access";
import { bindings, initializeDatabase } from "@/db/digests";

export const dynamic = "force-dynamic";

const COOLDOWN_SECONDS = 300;
const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const REDEPLOY_MUTATION = `
  mutation serviceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
    serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
  }
`;

export async function POST() {
  if (!(await getAllowedViewer())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const {
    DB,
    RAILWAY_PROJECT_TOKEN,
    RAILWAY_SERVICE_ID,
    RAILWAY_ENVIRONMENT_ID,
  } = bindings();
  if (!DB || !RAILWAY_PROJECT_TOKEN || !RAILWAY_SERVICE_ID || !RAILWAY_ENVIRONMENT_ID) {
    return Response.json({ error: "manual run unavailable" }, { status: 503 });
  }

  await initializeDatabase(DB);
  await DB.prepare(`
    INSERT OR IGNORE INTO manual_runs (id, requested_at)
    VALUES ('all-mailboxes', datetime('now', '-10 minutes'))
  `).run();
  const lock = await DB.prepare(`
    UPDATE manual_runs
    SET requested_at = datetime('now')
    WHERE id = 'all-mailboxes'
      AND requested_at <= datetime('now', '-5 minutes')
  `).run();
  if ((lock.meta.changes ?? 0) !== 1) {
    return Response.json(
      { error: "cooldown", retryAfterSeconds: COOLDOWN_SECONDS },
      { status: 429, headers: { "retry-after": String(COOLDOWN_SECONDS) } },
    );
  }

  const response = await fetch(RAILWAY_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "project-access-token": RAILWAY_PROJECT_TOKEN,
    },
    body: JSON.stringify({
      query: REDEPLOY_MUTATION,
      variables: {
        environmentId: RAILWAY_ENVIRONMENT_ID,
        serviceId: RAILWAY_SERVICE_ID,
      },
    }),
  });
  const result = (await response.json().catch(() => null)) as {
    data?: { serviceInstanceRedeploy?: boolean };
    errors?: unknown[];
  } | null;
  if (!response.ok || result?.errors?.length || result?.data?.serviceInstanceRedeploy !== true) {
    await DB.prepare(`
      UPDATE manual_runs
      SET requested_at = datetime('now', '-10 minutes')
      WHERE id = 'all-mailboxes'
    `).run();
    return Response.json({ error: "railway rejected request" }, { status: 502 });
  }

  return Response.json({ ok: true }, { status: 202 });
}

