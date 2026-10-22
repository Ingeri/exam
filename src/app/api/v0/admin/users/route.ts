import { isAuthFailure, requireRole } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const params = new URL(request.url).searchParams;
  const pageValue = Number(params.get("page") ?? 1);
  const limitValue = Number(params.get("limit") ?? 50);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : 50;
  const search = params.get("q")?.trim();
  const roleParam = params.get("role");
  if (roleParam && !Object.values(Role).includes(roleParam as Role)) return jsonError("role filter is invalid.", 400);

  const where = {
    ...(roleParam ? { role: roleParam as Role } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { email: { contains: search, mode: "insensitive" as const } },
      { registrationNumber: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  try {
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          registrationNumber: true,
          role: true,
          createdAt: true,
          _count: { select: { exams: true, attempts: true } },
        },
      }),
    ]);
    return Response.json({ users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch {
    return jsonError("Unable to fetch users.", 500);
  }
}

