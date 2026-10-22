import { isAuthFailure, requireRole } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { POST as submitAttempt } from "@/app/api/exams/[id]/attempt/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["STUDENT"]);
  if (isAuthFailure(auth)) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const proxied = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, userId: auth.user.id }),
  });
  return submitAttempt(proxied, { params });
}
