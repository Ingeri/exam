import { isAuthFailure, requireRole } from "@/lib/auth";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { hashExamKey } from "@/lib/exam-access";
import { prisma } from "@/lib/prisma";
import { ExamStatus } from "@prisma/client";

function parseDate(value: unknown): Date | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseAllowedStudents(value: unknown) {
  if (!Array.isArray(value)) return null;
  const result: { email: string | null; registrationNumber: string | null }[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const email = typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "";
    const registrationNumber = typeof entry.registrationNumber === "string" ? entry.registrationNumber.trim() : "";
    if ((!email && !registrationNumber) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
    result.push({ email: email || null, registrationNumber: registrationNumber || null });
  }
  return result;
}

export async function PUT(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);

  try {
    const existing = await prisma.exam.findUnique({ where: { id: examId } });
    if (!existing) return jsonError("Exam not found.", 404);
    if (auth.user.role !== "ADMIN" && existing.createdById !== auth.user.id) return jsonError("Exam not found.", 404);

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      if (!isNonEmptyString(body.title)) return jsonError("title must be a non-empty string.", 400);
      data.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== "string") return jsonError("description must be a string or null.", 400);
      data.description = typeof body.description === "string" ? body.description.trim() || null : null;
    }
    if (body.durationMinutes !== undefined) {
      if (!Number.isInteger(body.durationMinutes) || Number(body.durationMinutes) < 1) return jsonError("durationMinutes must be a positive integer.", 400);
      data.durationMinutes = body.durationMinutes;
    }
    if (body.passingScore !== undefined) {
      if (body.passingScore !== null && (!Number.isInteger(body.passingScore) || Number(body.passingScore) < 0 || Number(body.passingScore) > 100)) {
        return jsonError("passingScore must be an integer from 0 to 100 or null.", 400);
      }
      data.passingScore = body.passingScore;
    }
    if (body.isPublic !== undefined) {
      if (typeof body.isPublic !== "boolean") return jsonError("isPublic must be a boolean.", 400);
      data.isPublic = body.isPublic;
    }
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !Object.values(ExamStatus).includes(body.status as ExamStatus)) return jsonError("status is invalid.", 400);
      data.status = body.status;
    }
    if (body.opensAt !== undefined) {
      const value = parseDate(body.opensAt);
      if (value === undefined) return jsonError("opensAt must be an ISO date or null.", 400);
      data.opensAt = value;
    }
    if (body.closesAt !== undefined) {
      const value = parseDate(body.closesAt);
      if (value === undefined) return jsonError("closesAt must be an ISO date or null.", 400);
      data.closesAt = value;
    }
    const opensAt = body.opensAt === undefined ? existing.opensAt : data.opensAt as Date | null;
    const closesAt = body.closesAt === undefined ? existing.closesAt : data.closesAt as Date | null;
    if (opensAt && closesAt && opensAt >= closesAt) return jsonError("opensAt must be earlier than closesAt.", 400);

    if (body.examKey !== undefined) {
      if (body.examKey !== null && !isNonEmptyString(body.examKey)) return jsonError("examKey must be a non-empty string or null.", 400);
      data.examKey = typeof body.examKey === "string" ? hashExamKey(body.examKey) : null;
    }
    let allowedStudents: { email: string | null; registrationNumber: string | null }[] | undefined;
    if (body.allowedStudents !== undefined) {
      allowedStudents = parseAllowedStudents(body.allowedStudents) ?? undefined;
      if (!allowedStudents) return jsonError("allowedStudents must contain valid email and/or registrationNumber entries.", 400);
      if (body.isPublic === true && allowedStudents.length > 0) return jsonError("Public exams cannot also have a restricted allowedStudents list.", 400);
      if (body.isPublic === undefined && existing.isPublic && allowedStudents.length > 0) {
        return jsonError("Set isPublic to false before adding a restricted allowedStudents list.", 400);
      }
    }

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: {
        ...data,
        ...(allowedStudents ? {
          allowedStudents: {
            deleteMany: {},
            create: allowedStudents,
          },
        } : {}),
      },
      include: { allowedStudents: true, _count: { select: { questions: true, attempts: true } } },
    });
    return Response.json({ exam });
  } catch {
    return jsonError("Unable to update exam.", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;
  try {
    const existing = await prisma.exam.findUnique({ where: { id: examId }, select: { createdById: true } });
    if (!existing) return jsonError("Exam not found.", 404);
    if (auth.user.role !== "ADMIN" && existing.createdById !== auth.user.id) return jsonError("Exam not found.", 404);
    await prisma.exam.delete({ where: { id: examId } });
    return new Response(null, { status: 204 });
  } catch {
    return jsonError("Unable to delete exam.", 500);
  }
}
