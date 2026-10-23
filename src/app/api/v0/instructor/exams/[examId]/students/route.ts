import { Prisma } from "@prisma/client";
import { isAuthFailure, requireRole } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type StudentIdentity = { email: string | null; registrationNumber: string | null };

function addStudent(
  value: unknown,
  result: StudentIdentity[],
  emails: Set<string>,
  registrationNumbers: Set<string>,
): boolean {
  if (!isRecord(value)) return false;
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const registrationNumber = typeof value.registrationNumber === "string"
    ? value.registrationNumber.trim()
    : "";
  if (!email && !registrationNumber) return false;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return false;
  if (registrationNumber.length > 100) return false;

  const emailKey = email;
  const registrationKey = registrationNumber.toLowerCase();
  if ((emailKey && emails.has(emailKey)) || (registrationKey && registrationNumbers.has(registrationKey))) {
    return true;
  }
  if (emailKey) emails.add(emailKey);
  if (registrationKey) registrationNumbers.add(registrationKey);
  result.push({ email: email || null, registrationNumber: registrationNumber || null });
  return true;
}

function parseStudents(body: Record<string, unknown>): StudentIdentity[] | null {
  const result: StudentIdentity[] = [];
  const emails = new Set<string>();
  const registrationNumbers = new Set<string>();
  let validCount = 0;

  const hasSingle = "email" in body || "registrationNumber" in body;
  if (hasSingle) {
    if (!addStudent(body, result, emails, registrationNumbers)) return null;
    validCount++;
  }

  if (body.students !== undefined) {
    if (!Array.isArray(body.students) || body.students.length > 1000) return null;
    for (const entry of body.students) {
      if (!addStudent(entry, result, emails, registrationNumbers)) return null;
      validCount++;
    }
  }

  for (const [field, key] of [["emails", "email"], ["registrationNumbers", "registrationNumber"]] as const) {
    if (body[field] === undefined) continue;
    const values = body[field];
    if (!Array.isArray(values) || values.length > 1000) return null;
    for (const value of values) {
      if (typeof value !== "string" || !addStudent({ [key]: value }, result, emails, registrationNumbers)) {
        return null;
      }
      validCount++;
    }
  }

  if (validCount < 1 || validCount > 1000 || result.length < 1) return null;
  return result;
}

export async function POST(request: Request, { params }: { params: Promise<{ examId: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const students = parseStudents(body);
  if (!students) {
    return jsonError("Provide one student or a batch of 1 to 1000 valid email and/or registration number entries.", 400);
  }

  try {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, createdById: true, isPublic: true },
    });
    if (!exam || (auth.user.role !== "ADMIN" && exam.createdById !== auth.user.id)) {
      return jsonError("Exam not found.", 404);
    }
    if (exam.isPublic) return jsonError("Student enrollment is only available for private exams.", 409);

    const result = await prisma.allowedStudent.createMany({
      data: students.map((student) => ({ examId, ...student })),
      skipDuplicates: true,
    });
    return Response.json({ added: result.count, submitted: students.length }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonError("Exam not found.", 404);
    }
    return jsonError("Unable to enroll students.", 500);
  }
}
