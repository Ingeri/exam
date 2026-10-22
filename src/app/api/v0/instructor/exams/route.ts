import { isAuthFailure, requireRole } from "@/lib/auth";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { hasExamKeySecret, hashExamKey } from "@/lib/exam-access";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type AllowedStudentInput = { email?: string; registrationNumber?: string };

function parseAllowedStudents(value: unknown): AllowedStudentInput[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const result: AllowedStudentInput[] = [];
  const keys = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    const email = typeof entry.email === "string" ? entry.email.trim().toLowerCase() : "";
    const registrationNumber = typeof entry.registrationNumber === "string" ? entry.registrationNumber.trim() : "";
    if ((!email && !registrationNumber) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return null;
    if (email && keys.has(`e:${email}`)) return null;
    if (registrationNumber && keys.has(`r:${registrationNumber.toLowerCase()}`)) return null;
    if (email) keys.add(`e:${email}`);
    if (registrationNumber) keys.add(`r:${registrationNumber.toLowerCase()}`);
    result.push({ email: email || undefined, registrationNumber: registrationNumber || undefined });
  }
  return result;
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function validWindow(opensAt: Date | null, closesAt: Date | null): boolean {
  return !opensAt || !closesAt || opensAt < closesAt;
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  try {
    const exams = await prisma.exam.findMany({
      where: auth.user.role === "ADMIN" ? undefined : { createdById: auth.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true, attempts: true, allowedStudents: true } },
      },
    });
    return Response.json({ exams });
  } catch {
    return jsonError("Unable to fetch instructor exams.", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);

  if (!isNonEmptyString(body.title) || !Number.isInteger(body.durationMinutes) || Number(body.durationMinutes) < 1) {
    return jsonError("title and a positive integer durationMinutes are required.", 400);
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    return jsonError("description must be a string or null.", 400);
  }
  if (body.passingScore !== undefined && body.passingScore !== null &&
      (!Number.isInteger(body.passingScore) || Number(body.passingScore) < 0 || Number(body.passingScore) > 100)) {
    return jsonError("passingScore must be an integer from 0 to 100 or null.", 400);
  }
  if (body.isPublic !== undefined && typeof body.isPublic !== "boolean") return jsonError("isPublic must be a boolean.", 400);
  if (body.examKey !== undefined && body.examKey !== null && !isNonEmptyString(body.examKey)) {
    return jsonError("examKey must be a non-empty string or null.", 400);
  }
  if (typeof body.examKey === "string" && !hasExamKeySecret()) return jsonError("Exam key storage is not configured.", 503);
  const opensAt = parseDate(body.opensAt);
  const closesAt = parseDate(body.closesAt);
  if ((body.opensAt !== undefined && opensAt === undefined) || (body.closesAt !== undefined && closesAt === undefined)) {
    return jsonError("opensAt and closesAt must be ISO dates or null.", 400);
  }
  if (!validWindow(opensAt ?? null, closesAt ?? null)) return jsonError("opensAt must be earlier than closesAt.", 400);
  const allowedStudents = parseAllowedStudents(body.allowedStudents);
  if (!allowedStudents) return jsonError("allowedStudents must contain valid email and/or registrationNumber entries.", 400);
  if (body.isPublic === true && allowedStudents.length > 0) {
    return jsonError("Public exams cannot also have a restricted allowedStudents list.", 400);
  }

  try {
    const exam = await prisma.$transaction(async (tx) => {
      if (auth.user.role === "INSTRUCTOR") {
        const setting = await tx.systemSetting.findUnique({ where: { key: "maxExamsPerMonth" } });
        const limit = typeof setting?.value === "number" && Number.isInteger(setting.value) && setting.value >= 0
          ? setting.value
          : 10;
        
        const monthStart = new Date();
        monthStart.setUTCDate(1);
        monthStart.setUTCHours(0, 0, 0, 0);
        const count = await tx.exam.count({ where: { createdById: auth.user.id, createdAt: { gte: monthStart } } });
        if (count >= limit) return null;
      }

      return tx.exam.create({
        data: {
          title: (body.title as string).trim(),
          description: typeof body.description === "string" ? body.description.trim() || null : null,
          durationMinutes: Number(body.durationMinutes),
          passingScore: typeof body.passingScore === "number" ? body.passingScore : null,
          opensAt: opensAt ?? null,
          closesAt: closesAt ?? null,
          examKey: typeof body.examKey === "string" ? hashExamKey(body.examKey) : null,
          isPublic: body.isPublic === true,
          createdById: auth.user.id,
          allowedStudents: allowedStudents.length ? {
            create: allowedStudents.map((student) => ({
              email: student.email ?? null,
              registrationNumber: student.registrationNumber ?? null,
            })),
          } : undefined,
        },
        include: { allowedStudents: true, _count: { select: { questions: true, attempts: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!exam) return jsonError("You have reached the monthly exam creation limit.", 429);
    return Response.json({ exam }, { status: 201 });
  } catch {
    return jsonError("Unable to create exam.", 500);
  }
}
