import { getChatGPTUser } from "./chatgpt-auth";

export function isAllowedViewer(email: string) {
  const configured = process.env.ALLOWED_VIEWER_EMAILS ?? "";
  return configured
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function getAllowedViewer() {
  const user = await getChatGPTUser();
  return user && isAllowedViewer(user.email) ? user : null;
}

