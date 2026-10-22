import { randomInt } from "node:crypto";
import { isAuthFailure, requireRole, verifySignedToken } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index--) {
    const other = randomInt(index + 1);
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["STUDENT"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        allowedStudents: { select: { email: true, registrationNumber: true } },
        questions: {
          orderBy: { orderIndex: "asc" },
          include: {
            options: { orderBy: { orderIndex: "asc" } },
            matchPairs: { orderBy: { orderIndex: "asc" } },
            gridRows: { orderBy: { orderIndex: "asc" } },
            gridColumns: { orderBy: { orderIndex: "asc" } },
            blanks: { orderBy: { orderIndex: "asc" } },
          },
        },
      },
    });
    if (!exam || exam.status !== "PUBLISHED") return jsonError("Exam not found.", 404);
    const authorized = exam.isPublic || exam.allowedStudents.some((allowed) =>
      (allowed.email && allowed.email.toLowerCase() === auth.user.email.toLowerCase()) ||
      (allowed.registrationNumber && allowed.registrationNumber === auth.user.registrationNumber));
    if (!authorized) return jsonError("Exam not found.", 404);

    const now = new Date();
    if (exam.opensAt && now <= exam.opensAt) return jsonError("This exam has not opened yet.", 409);
    if (exam.closesAt && now >= exam.closesAt) return jsonError("The exam window has closed.", 409);

    if (exam.examKey) {
      const token = request.headers.get("x-exam-key-token");
      const claims = token ? verifySignedToken(token) : null;
      if (!claims || claims.kind !== "exam-key" || claims.examId !== examId || claims.sub !== auth.user.id) {
        return jsonError("Verify the exam key before retrieving exam questions.", 403);
      }
    }

    const questions = exam.questions.map((question) => ({
      id: question.id,
      type: question.type,
      text: question.text,
      points: question.points,
      orderIndex: question.orderIndex,
      options: question.options.map(({ id, text, orderIndex }) => ({ id, text, orderIndex })),
      matchPairs: question.matchPairs.map(({ id, leftText, orderIndex }) => ({ id, leftText, orderIndex })),
      matchChoices: shuffle(question.matchPairs.map((pair) => pair.rightText)),
      gridRows: question.gridRows.map(({ id, text, orderIndex }) => ({ id, text, orderIndex })),
      gridColumns: question.gridColumns.map(({ id, text, orderIndex }) => ({ id, text, orderIndex })),
      blanks: question.blanks.map(({ id, blankIdentifier, orderIndex }) => ({ id, blankIdentifier, orderIndex })),
    }));

    return Response.json({
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        opensAt: exam.opensAt,
        closesAt: exam.closesAt,
      },
      questions,
    });
  } catch {
    return jsonError("Unable to fetch exam questions.", 500);
  }
}
