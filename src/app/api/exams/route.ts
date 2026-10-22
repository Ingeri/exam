import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { questions: true } },
      },
    });

    return Response.json({ exams });
  } catch {
    return jsonError("Unable to fetch exams.", 500);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);

  const { title, description, durationMinutes, passingScore, createdById } = body;
  if (!isNonEmptyString(title) || !isNonEmptyString(createdById)) {
    return jsonError("title and createdById are required strings.", 400);
  }
  if (!Number.isInteger(durationMinutes) || Number(durationMinutes) <= 0) {
    return jsonError("durationMinutes must be a positive integer.", 400);
  }
  if (passingScore !== undefined && passingScore !== null &&
      (typeof passingScore !== "number" || !Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100)) {
    return jsonError("passingScore must be a number from 0 to 100 or null.", 400);
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    return jsonError("description must be a string or null.", 400);
  }

  try {
    const creator = await prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
    if (!creator) return jsonError("Creator not found.", 404);

    const exam = await prisma.exam.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        durationMinutes: Number(durationMinutes),
        passingScore: typeof passingScore === "number" ? passingScore : null,
        createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { questions: true } },
      },
    });

    return Response.json({ exam }, { status: 201 });
  } catch {
    return jsonError("Unable to create exam.", 500);
  }
}
