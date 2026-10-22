import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { GET as getAttempt } from "@/app/api/attempts/[attemptId]/route";

export async function GET(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await requireRole(request, ["STUDENT", "INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { attemptId } = await params;
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: { userId: true, exam: { select: { createdById: true } } },
  });
  if (!attempt) return jsonError("Attempt not found.", 404);
  const allowed = auth.user.role === "ADMIN" ||
    (auth.user.role === "STUDENT" && attempt.userId === auth.user.id) ||
    (auth.user.role === "INSTRUCTOR" && attempt.exam.createdById === auth.user.id);
  if (!allowed) return jsonError("Attempt not found.", 404);
  return getAttempt(request, { params: Promise.resolve({ attemptId }) });
}
