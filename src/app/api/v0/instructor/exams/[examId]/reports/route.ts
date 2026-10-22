import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const distributionBands = [
  { label: "0-49", min: 0, max: 50 },
  { label: "50-59", min: 50, max: 60 },
  { label: "60-69", min: 60, max: 70 },
  { label: "70-79", min: 70, max: 80 },
  { label: "80-89", min: 80, max: 90 },
  { label: "90-100", min: 90, max: 101 },
];

export async function GET(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: { select: { id: true, points: true } },
        attempts: {
          orderBy: { submittedAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true, registrationNumber: true } },
            answers: { select: { questionId: true, isCorrect: true, pointsEarned: true } },
          },
        },
      },
    });
    if (!exam) return jsonError("Exam not found.", 404);
    if (auth.user.role !== "ADMIN" && exam.createdById !== auth.user.id) return jsonError("Exam not found.", 404);

    const pointsPossible = exam.questions.reduce((total, question) => total + question.points, 0);
    const submitted = exam.attempts.filter((attempt) => attempt.submittedAt !== null);
    const marks = submitted.map((attempt) => {
      const earned = attempt.score ?? attempt.answers.reduce((total, answer) => total + (answer.pointsEarned ?? 0), 0);
      const percentage = pointsPossible ? earned / pointsPossible * 100 : 0;
      return {
        attemptId: attempt.id,
        student: attempt.user,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        pointsEarned: earned,
        pointsPossible,
        percentage,
        requiresManualReview: attempt.answers.some((answer) => answer.isCorrect === null),
      };
    });
    const gradeDistribution = distributionBands.map((band) => ({
      band: band.label,
      count: marks.filter((mark) => mark.percentage >= band.min && mark.percentage < band.max).length,
    }));

    return Response.json({
      exam: { id: exam.id, title: exam.title, questionCount: exam.questions.length, pointsPossible },
      submissionCount: submitted.length,
      pendingManualReviewCount: marks.filter((mark) => mark.requiresManualReview).length,
      averagePercentage: marks.length ? marks.reduce((total, mark) => total + mark.percentage, 0) / marks.length : 0,
      gradeDistribution,
      marks,
    });
  } catch {
    return jsonError("Unable to fetch exam reports.", 500);
  }
}
