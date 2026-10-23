import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.email !== "string" || typeof body.password !== "string") {
    return jsonError("email and password are required.", 400);
  }
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || Buffer.byteLength(body.password, "utf8") > 72) {
    return jsonError("Invalid email or password.", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        registrationNumber: true,
        role: true,
        passwordHash: true,
      },
    });
    const validPassword = user?.passwordHash
      ? await compare(body.password, user.passwordHash)
      : false;
    if (!user || !validPassword) return jsonError("Invalid email or password.", 401);

    const token = signToken({ sub: user.id }, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    if (!token) return jsonError("Authentication is not configured.", 503);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return Response.json({ user: safeUser, token, tokenType: "Bearer", expiresIn: 604800 });
  } catch {
    return jsonError("Unable to log in.", 500);
  }
}
