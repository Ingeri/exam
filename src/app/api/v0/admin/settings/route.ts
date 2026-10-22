import { isAuthFailure, requireRole } from "@/lib/auth";
import { isRecord, jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_EXAMS_PER_MONTH = 10;

export async function GET(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "maxExamsPerMonth" } });
    const maxExamsPerMonth = typeof setting?.value === "number" ? setting.value : DEFAULT_MAX_EXAMS_PER_MONTH;
    return Response.json({ settings: { maxExamsPerMonth } });
  } catch {
    return jsonError("Unable to fetch system settings.", 500);
  }
}

export async function PUT(request: Request) {
  const auth = await requireRole(request, ["ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const body = await readJson(request);
  if (!isRecord(body) || !Number.isInteger(body.maxExamsPerMonth) ||
      Number(body.maxExamsPerMonth) < 0 || Number(body.maxExamsPerMonth) > 10000) {
    return jsonError("maxExamsPerMonth must be an integer from 0 to 10000.", 400);
  }

  try {
    const setting = await prisma.systemSetting.upsert({
      where: { key: "maxExamsPerMonth" },
      create: { key: "maxExamsPerMonth", value: Number(body.maxExamsPerMonth) },
      update: { value: Number(body.maxExamsPerMonth) },
    });
    return Response.json({ setting: { key: setting.key, value: setting.value, updatedAt: setting.updatedAt } });
  } catch {
    return jsonError("Unable to update system settings.", 500);
  }
}
