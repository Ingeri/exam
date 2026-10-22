import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import type { Role, User } from "@prisma/client";

export type Principal = Pick<User, "id" | "name" | "email" | "registrationNumber" | "role">;
type AuthResult = { user: Principal; response?: never } | { user?: never; response: Response };

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function configuredSecret(): string | null {
  const secret = process.env.AUTH_JWT_SECRET;
  return secret && Buffer.byteLength(secret) >= 32 ? secret : null;
}

export function signToken(payload: Record<string, unknown>, expiresAt: Date): string | null {
  const secret = configuredSecret();
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: Math.floor(expiresAt.getTime() / 1000) })).toString("base64url");
  const content = `${header}.${body}`;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");
  return `${content}.${signature}`;
}

export function verifySignedToken(token: string): Record<string, unknown> | null {
  const secret = configuredSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (!header || header.alg !== "HS256" || !payload) return null;

  const expected = createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now ||
      (typeof payload.nbf === "number" && payload.nbf > now) ||
      (typeof payload.iat === "number" && payload.iat > now + 60)) return null;
  if (process.env.AUTH_JWT_ISSUER && payload.iss !== process.env.AUTH_JWT_ISSUER) return null;
  if (process.env.AUTH_JWT_AUDIENCE && payload.aud !== process.env.AUTH_JWT_AUDIENCE) return null;
  return payload;
}

async function resolvePrincipal(request: Request, optional: boolean): Promise<AuthResult | { user: null; response?: never }> {
  const header = request.headers.get("authorization");
  if (!header && optional) return { user: null };
  if (!header?.startsWith("Bearer ")) return { response: jsonError("Bearer authentication is required.", 401) };

  if (!configuredSecret()) return { response: jsonError("Authentication is not configured.", 503) };
  const payload = verifySignedToken(header.slice(7));
  if (!payload || typeof payload.sub !== "string") return { response: jsonError("Bearer token is invalid or expired.", 401) };

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, registrationNumber: true, role: true },
    });
    if (!user) return { response: jsonError("Authenticated user no longer exists.", 401) };
    return { user };
  } catch {
    return { response: jsonError("Unable to verify authenticated user.", 503) };
  }
}

export async function authenticate(request: Request): Promise<AuthResult> {
  const result = await resolvePrincipal(request, false);
  if (!result.user && !result.response) return { response: jsonError("Authentication is required.", 401) };
  return result as AuthResult;
}

export async function authenticateOptional(request: Request): Promise<AuthResult | { user: null; response?: never }> {
  return resolvePrincipal(request, true);
}

export async function requireRole(request: Request, roles: Role[]): Promise<AuthResult> {
  const result = await authenticate(request);
  if (!result.user) return result.response ? { response: result.response } : { response: jsonError("Authentication is required.", 401) };
  if (!roles.includes(result.user.role)) return { response: jsonError("You do not have permission to access this resource.", 403) };
  return result;
}

export function isAuthFailure(result: AuthResult): result is { response: Response } {
  return !result.user;
}
