import { hash } from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { signToken } from "@/lib/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_COST = 12;

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === undefined ? "STUDENT" : body.role;
  const registrationNumber = typeof body.registrationNumber === "string"
    ? body.registrationNumber.trim()
    : null;

  if (name.length < 1 || name.length > 120) return jsonError("name must contain 1 to 120 characters.", 400);
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return jsonError("A valid email is required.", 400);
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    return jsonError("password must contain 12 to 72 characters.", 400);
  }
  if (role !== "STUDENT" && role !== "INSTRUCTOR") {
    return jsonError("role must be STUDENT or INSTRUCTOR.", 400);
  }
  if (body.registrationNumber !== undefined &&
      (typeof body.registrationNumber !== "string" || !registrationNumber || registrationNumber.length > 100)) {
    return jsonError("registrationNumber must contain 1 to 100 characters.", 400);
  }
  if (!process.env.AUTH_JWT_SECRET || Buffer.byteLength(process.env.AUTH_JWT_SECRET) < 32) {
    return jsonError("Authentication is not configured.", 503);
  }

  try {
    const passwordHash = await hash(password, PASSWORD_COST);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, registrationNumber, role: role as Role },
      select: { id: true, name: true, email: true, registrationNumber: true, role: true },
    });
    const token = signToken({ sub: user.id }, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    if (!token) return jsonError("Authentication is not configured.", 503);
    return Response.json({ user, token, tokenType: "Bearer", expiresIn: 604800 }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return jsonError("An account with this email already exists.", 409);
    }
    return jsonError("Unable to register account.", 500);
  }
}
