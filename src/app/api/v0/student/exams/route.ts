import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["STUDENT"]);
  if (isAuthFailure(auth)) return auth.response;

  try {
    const exams = await prisma.exam.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { isPublic: true },
          { allowedStudents: { some: { OR: [
            { email: auth.user.email.toLowerCase() },
            ...(auth.user.registrationNumber ? [{ registrationNumber: auth.user.registrationNumber }] : []),
          ] } } },
        ],
      },
      orderBy: { opensAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        durationMinutes: true,
        passingScore: true,
        opensAt: true,
        closesAt: true,
        isPublic: true,
        _count: { select: { questions: true } },
      },
    });
    return Response.json({ exams });
  } catch {
    return jsonError("Unable to fetch available exams.", 500);
  }
}
