import { isAuthFailure, requireRole, signToken } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { matchesExamKey } from "@/lib/exam-access";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["STUDENT"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.examKey !== "string" || body.examKey.trim().length === 0) {
    return jsonError("examKey is required.", 400);
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: {
        id: true,
        status: true,
        isPublic: true,
        examKey: true,
        closesAt: true,
        allowedStudents: { select: { email: true, registrationNumber: true } },
      },
    });
    if (!exam || exam.status !== "PUBLISHED") return jsonError("Exam not found.", 404);
    if (!exam.isPublic && !exam.allowedStudents.some((allowed) =>
      (allowed.email && allowed.email.toLowerCase() === auth.user.email.toLowerCase()) ||
      (allowed.registrationNumber && allowed.registrationNumber === auth.user.registrationNumber))) {
      return jsonError("You are not authorized for this exam.", 403);
    }
    if (!exam.examKey) return jsonError("This exam does not require an access key.", 409);
    if (!matchesExamKey(body.examKey, exam.examKey)) return jsonError("Exam key is incorrect.", 403);

    const tokenExpiry = new Date(Date.now() + 30 * 60 * 1000);
    const expiresAt = exam.closesAt && exam.closesAt < tokenExpiry ? exam.closesAt : tokenExpiry;
    const keyToken = signToken({ sub: auth.user.id, kind: "exam-key", examId }, expiresAt);
    if (!keyToken) return jsonError("Authentication is not configured.", 503);
    return Response.json({ verified: true, keyToken, expiresAt });
  } catch {
    return jsonError("Unable to verify exam key.", 500);
  }
}
