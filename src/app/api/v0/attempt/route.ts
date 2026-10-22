import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { POST as submitExamAttempt } from "@/app/api/exams/[id]/attempt/route";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  if (!isNonEmptyString(body.examId)) return jsonError("examId is required.", 400);

  const { examId, ...submission } = body;
  const forwardedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(submission),
  });

  return submitExamAttempt(forwardedRequest, { params: Promise.resolve({ id: examId }) });
}
