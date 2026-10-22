import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { POST as addQuestion } from "@/app/api/exams/[id]/questions/route";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await params;
  const exam = await prisma.exam.findUnique({ where: { id }, select: { createdById: true } });
  if (!exam) return jsonError("Exam not found.", 404);
  if (auth.user.role !== "ADMIN" && exam.createdById !== auth.user.id) return jsonError("Exam not found.", 404);
  return addQuestion(request, { params: Promise.resolve({ id }) });
}
