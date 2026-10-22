import { authenticateOptional } from "@/lib/auth";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { POST as submitAttempt } from "@/app/api/exams/[id]/attempt/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateOptional(request);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const { id: examId } = await params;

  let userId: string;
  if (auth.user) {
    if (auth.user.role !== "STUDENT") return jsonError("Only students can submit authenticated attempts.", 403);
    userId = auth.user.id;
  } else {
    if (!isNonEmptyString(body.name) || !isNonEmptyString(body.email) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return jsonError("Public guest submissions require a name and valid email.", 400);
    }
    try {
      const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true, isPublic: true, status: true } });
      if (!exam) return jsonError("Exam not found.", 404);
      if (exam.status !== "PUBLISHED") return jsonError("Only published exams can be submitted.", 409);
      if (!exam.isPublic) return jsonError("Guest submissions are only allowed for public exams.", 403);
      const email = body.email.trim().toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
      if (existing && existing.role !== "STUDENT") return jsonError("This email is already associated with a non-student account.", 409);
      const guest = existing ?? await prisma.user.create({
        data: { name: body.name.trim(), email, role: "STUDENT" },
        select: { id: true },
      });
      userId = guest.id;
    } catch {
      return jsonError("Unable to register guest student.", 500);
    }
  }

  const proxied = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ ...body, userId }),
  });
  return submitAttempt(proxied, { params: Promise.resolve({ id: examId }) });
}
