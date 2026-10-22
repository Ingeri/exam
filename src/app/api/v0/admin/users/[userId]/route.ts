import { isAuthFailure, requireRole } from "@/lib/auth";
import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { userId } = await params;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);
  const data: { name?: string; role?: Role; registrationNumber?: string | null } = {};
  if ("name" in body) {
    if (!isNonEmptyString(body.name)) return jsonError("name must be a non-empty string.", 400);
    data.name = body.name.trim();
  }
  if ("role" in body) {
    if (typeof body.role !== "string" || !Object.values(Role).includes(body.role as Role)) return jsonError("role is invalid.", 400);
    data.role = body.role as Role;
  }
  if ("registrationNumber" in body) {
    if (body.registrationNumber !== null && !isNonEmptyString(body.registrationNumber)) {
      return jsonError("registrationNumber must be a non-empty string or null.", 400);
    }
    data.registrationNumber = typeof body.registrationNumber === "string" ? body.registrationNumber.trim() : null;
  }
  if (!Object.keys(data).length) return jsonError("Provide name, role, or registrationNumber to update.", 400);

  try {
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) return jsonError("User not found.", 404);
    if (data.registrationNumber) {
      const duplicate = await prisma.user.findFirst({
        where: { registrationNumber: data.registrationNumber, id: { not: userId } },
        select: { id: true },
      });
      if (duplicate) return jsonError("registrationNumber is already assigned.", 409);
    }
    const user = await prisma.$transaction(async (tx) => {
      if (target.role === "ADMIN" && data.role && data.role !== "ADMIN") {
        const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) return null;
      }
      return tx.user.update({
        where: { id: userId },
        data,
        select: { id: true, name: true, email: true, registrationNumber: true, role: true, updatedAt: true },
      });
    }, { isolationLevel: "Serializable" });
    if (!user) return jsonError("The last administrator cannot be demoted.", 409);
    return Response.json({ user });
  } catch {
    return jsonError("Unable to update user.", 500);
  }
}
