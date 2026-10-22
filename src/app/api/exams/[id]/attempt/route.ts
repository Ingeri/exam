import { hasValidAnswerShape, gradeAnswer } from "@/lib/grading";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  if (!isNonEmptyString(body.userId)) return jsonError("userId is required.", 400);
  if (!isRecord(body.answers)) return jsonError("answers must be an object keyed by question ID.", 400);
  const answers = body.answers;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
          include: { options: true, matchPairs: true, blanks: true, gridRows: true, gridColumns: true },
        },
      },
    });
    if (!exam) return jsonError("Exam not found.", 404);
    if (exam.status !== "PUBLISHED") return jsonError("Only published exams can be submitted.", 409);

    const user = await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } });
    if (!user) return jsonError("User not found.", 404);

    const questionIds = new Set(exam.questions.map((question) => question.id));
    const suppliedIds = Object.keys(answers);
    if (suppliedIds.some((questionId) => !questionIds.has(questionId))) {
      return jsonError("answers contains a question that does not belong to this exam.", 400);
    }

    for (const question of exam.questions) {
      const value = answers[question.id];
      if (value !== undefined && !hasValidAnswerShape(value, question)) {
        return jsonError(`Answer for question ${question.id} has an invalid shape.`, 400);
      }
    }

    const breakdown = exam.questions.map((question) => {
      const answerValue = answers[question.id] ?? {};
      const grade = gradeAnswer(answerValue, question);
      return {
        questionId: question.id,
        questionText: question.text,
        type: question.type,
        answerValue,
        pointsPossible: question.points,
        ...grade,
      };
    });
    const pointsEarned = breakdown.reduce((total, item) => total + (item.pointsEarned ?? 0), 0);
    const pointsPossible = exam.questions.reduce((total, question) => total + question.points, 0);
    const percentage = pointsPossible === 0 ? 0 : (pointsEarned / pointsPossible) * 100;
    const requiresManualReview = breakdown.some((item) => item.requiresManualReview);

    const attempt = await prisma.$transaction(async (tx) => {
      const createdAttempt = await tx.examAttempt.create({
        data: {
          examId,
          userId: body.userId as string,
          status: requiresManualReview ? "SUBMITTED" : "GRADED",
          submittedAt: new Date(),
          score: pointsEarned,
          answers: {
            create: breakdown.map((item) => ({
              questionId: item.questionId,
              answerValue: item.answerValue as Prisma.InputJsonValue,
              isCorrect: item.correct,
              pointsEarned: item.pointsEarned,
            })),
          },
        },
        select: { id: true, status: true, submittedAt: true },
      });
      return createdAttempt;
    });

    return Response.json({
      attempt,
      score: { pointsEarned, pointsPossible, percentage, requiresManualReview },
      breakdown,
    }, { status: 201 });
  } catch {
    return jsonError("Unable to submit exam attempt.", 500);
  }
}
