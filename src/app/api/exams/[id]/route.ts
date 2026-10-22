import { jsonError } from "@/lib/api";
import { isAuthFailure, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const questionIncludes = {
  options: { orderBy: { orderIndex: "asc" as const } },
  matchPairs: { orderBy: { orderIndex: "asc" as const } },
  gridRows: { orderBy: { orderIndex: "asc" as const } },
  gridColumns: { orderBy: { orderIndex: "asc" as const } },
  blanks: { orderBy: { orderIndex: "asc" as const } },
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(_request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { id } = await params;

  try {
    const access = await prisma.exam.findUnique({ where: { id }, select: { createdById: true } });
    if (!access) return jsonError("Exam not found.", 404);
    if (auth.user.role !== "ADMIN" && access.createdById !== auth.user.id) return jsonError("Exam not found.", 404);
    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        questions: { orderBy: { orderIndex: "asc" }, include: questionIncludes },
      },
    });

    if (!exam) return jsonError("Exam not found.", 404);
    return Response.json({ exam });
  } catch {
    return jsonError("Unable to fetch exam.", 500);
  }
}
