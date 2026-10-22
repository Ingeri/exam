import { isAuthFailure, requireRole } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ExamStatus } from "@prisma/client";

export async function PATCH(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.status !== "string" || !Object.values(ExamStatus).includes(body.status as ExamStatus)) {
    return jsonError("status must be DRAFT, PUBLISHED, or ARCHIVED.", 400);
  }
  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, include: { _count: { select: { questions: true } } } });
    if (!exam) return jsonError("Exam not found.", 404);
    if (body.status === "PUBLISHED" && exam._count.questions === 0) {
      return jsonError("An exam needs at least one question before it can be published.", 409);
    }
    const updated = await prisma.exam.update({
      where: { id: examId },
      data: { status: body.status as ExamStatus },
      select: { id: true, title: true, status: true, updatedAt: true },
    });
    return Response.json({ exam: updated });
  } catch {
    return jsonError("Unable to moderate exam.", 500);
  }
}
