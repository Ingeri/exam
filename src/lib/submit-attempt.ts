import { hasValidAnswerShape, gradeAnswer } from "@/lib/grading";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function submitAttemptAnswers(examId: string, userId: string, answers: Record<string, unknown>) {
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

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return jsonError("User not found.", 404);

    const questionIds = new Set(exam.questions.map((question) => question.id));
    if (Object.keys(answers).some((questionId) => !questionIds.has(questionId))) {
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
      return {
        questionId: question.id,
        questionText: question.text,
        type: question.type,
        answerValue,
        pointsPossible: question.points,
        ...gradeAnswer(answerValue, question),
      };
    });
    const pointsEarned = breakdown.reduce((total, answer) => total + (answer.pointsEarned ?? 0), 0);
    const pointsPossible = exam.questions.reduce((total, question) => total + question.points, 0);
    const percentage = pointsPossible === 0 ? 0 : pointsEarned / pointsPossible * 100;
    const requiresManualReview = breakdown.some((answer) => answer.requiresManualReview);

    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        userId,
        status: requiresManualReview ? "SUBMITTED" : "GRADED",
        submittedAt: new Date(),
        score: pointsEarned,
        answers: {
          create: breakdown.map((answer) => ({
            questionId: answer.questionId,
            answerValue: answer.answerValue as Prisma.InputJsonValue,
            isCorrect: answer.correct,
            pointsEarned: answer.pointsEarned,
          })),
        },
      },
      select: { id: true, status: true, submittedAt: true },
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
