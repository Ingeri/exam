import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  const { attemptId } = await params;

  try {
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            questions: { select: { id: true, points: true } },
          },
        },
        user: { select: { id: true, name: true } },
        answers: {
          orderBy: { question: { orderIndex: "asc" } },
          include: {
            question: { select: { id: true, type: true, text: true, points: true, orderIndex: true } },
          },
        },
      },
    });

    if (!attempt) return jsonError("Attempt not found.", 404);

    const pointsPossible = attempt.exam.questions.reduce((total, question) => total + question.points, 0);
    const pointsEarned = attempt.score ?? attempt.answers.reduce((total, answer) => total + (answer.pointsEarned ?? 0), 0);
    const percentage = pointsPossible === 0 ? 0 : (pointsEarned / pointsPossible) * 100;
    const requiresManualReview = attempt.answers.some((answer) => answer.isCorrect === null);

    return Response.json({
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        user: attempt.user,
        exam: { id: attempt.exam.id, title: attempt.exam.title },
      },
      score: {
        pointsEarned,
        pointsPossible,
        percentage,
        passingScore: attempt.exam.passingScore,
        passed: requiresManualReview || attempt.exam.passingScore === null
          ? null
          : percentage >= attempt.exam.passingScore,
        requiresManualReview,
        isProvisional: requiresManualReview,
      },
      answers: attempt.answers.map((answer) => ({
        question: answer.question,
        answerValue: answer.answerValue,
        isCorrect: answer.isCorrect,
        pointsEarned: answer.pointsEarned,
        requiresManualReview: answer.isCorrect === null,
      })),
    });
  } catch {
    return jsonError("Unable to fetch attempt results.", 500);
  }
}
