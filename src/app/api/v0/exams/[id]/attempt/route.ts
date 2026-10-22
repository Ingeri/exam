import { authenticateOptional, verifySignedToken } from "@/lib/auth";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { matchesExamKey } from "@/lib/exam-access";
import { prisma } from "@/lib/prisma";
import { POST as submitAttempt } from "@/app/api/exams/[id]/attempt/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateOptional(request);
  if (auth.response) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const { id: examId } = await params;

  let exam;
  try {
    exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        status: true,
        isPublic: true,
        opensAt: true,
        closesAt: true,
        examKey: true,
        allowedStudents: { select: { email: true, registrationNumber: true } },
      },
    });
  } catch {
    return jsonError("Unable to verify exam access.", 500);
  }
  if (!exam) return jsonError("Exam not found.", 404);
  if (exam.status !== "PUBLISHED") return jsonError("Only published exams can be submitted.", 409);
  const now = new Date();
  if (exam.opensAt && now <= exam.opensAt) return jsonError("This exam has not opened yet.", 409);
  if (exam.closesAt && now >= exam.closesAt) return jsonError("The submission window for this exam has closed.", 409);

  if (exam.examKey) {
    const enteredKeyValid = typeof body.examKey === "string" && matchesExamKey(body.examKey, exam.examKey);
    const claims = typeof body.keyToken === "string" ? verifySignedToken(body.keyToken) : null;
    const tokenValid = Boolean(auth.user && claims && claims.kind === "exam-key" && claims.examId === examId && claims.sub === auth.user.id);
    if (!enteredKeyValid && !tokenValid) return jsonError("A valid exam key verification is required.", 403);
  } else if (body.examKey !== undefined && body.examKey !== null) {
    return jsonError("This exam does not use an access key.", 400);
  }

  let userId: string;
  if (auth.user) {
    if (auth.user.role !== "STUDENT") return jsonError("Only students can submit authenticated attempts.", 403);
    const authorized = exam.isPublic || exam.allowedStudents.some((allowed) =>
      (allowed.email && allowed.email.toLowerCase() === auth.user.email.toLowerCase()) ||
      (allowed.registrationNumber && allowed.registrationNumber === auth.user.registrationNumber));
    if (!authorized) return jsonError("You are not authorized for this exam.", 403);
    userId = auth.user.id;
  } else {
    if (!isNonEmptyString(body.name) || !isNonEmptyString(body.email) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return jsonError("Public guest submissions require a name and valid email.", 400);
    }
    try {
      if (!exam.isPublic) return jsonError("Guest submissions are only allowed for public exams.", 403);
      const email = body.email.trim().toLowerCase();
      const guest = await prisma.user.upsert({
        where: { email },
        create: { name: body.name.trim(), email, role: "STUDENT" },
        update: {},
        select: { id: true, role: true },
      });
      if (guest.role !== "STUDENT") return jsonError("This email is already associated with a non-student account.", 409);
      userId = guest.id;
    } catch {
      return jsonError("Unable to register guest student.", 500);
    }
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const proxied = new Request(request.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, userId }),
  });
  return submitAttempt(proxied, { params: Promise.resolve({ id: examId }) });
}
