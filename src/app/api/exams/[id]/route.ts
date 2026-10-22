import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const questionIncludes = {
  options: { orderBy: { orderIndex: "asc" as const } },
  matchPairs: { orderBy: { orderIndex: "asc" as const } },
  gridRows: { orderBy: { orderIndex: "asc" as const } },
  gridColumns: { orderBy: { orderIndex: "asc" as const } },
  blanks: { orderBy: { orderIndex: "asc" as const } },
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
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
