import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function pagination(request: Request) {
  const params = new URL(request.url).searchParams;
  const pageValue = Number(params.get("page") ?? 1);
  const limitValue = Number(params.get("limit") ?? 50);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 50;
  return { page, limit, skip: (page - 1) * limit };
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { page, limit, skip } = pagination(request);
  try {
    const [total, exams] = await prisma.$transaction([
      prisma.exam.count(),
      prisma.exam.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { questions: true, attempts: true, allowedStudents: true } },
        },
      }),
    ]);
    return Response.json({ exams, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch {
    return jsonError("Unable to fetch exams.", 500);
  }
}
