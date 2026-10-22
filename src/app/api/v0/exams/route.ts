import { requireRole } from "@/lib/auth";
import { isAuthFailure } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import {
  GET as listExams,
  POST as createExam,
} from "@/app/api/v0/instructor/exams/route";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  return listExams(request);
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const proxied = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, createdById: auth.user.id }),
  });
  return createExam(proxied);
}
