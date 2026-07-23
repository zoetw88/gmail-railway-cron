import { getAllowedViewer } from "@/app/viewer-access";
import { bindings } from "@/db/digests";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getAllowedViewer())) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const publicKey = bindings().VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return Response.json({ error: "push unavailable" }, { status: 503 });
  }
  return Response.json({ publicKey }, { headers: { "cache-control": "no-store" } });
}

