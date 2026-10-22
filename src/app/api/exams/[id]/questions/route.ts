import { isNonEmptyString, isRecord, jsonError, readJson } from "@/lib/api";
import { isAuthFailure, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { QuestionType } from "@prisma/client";

const questionTypes = new Set<string>(Object.values(QuestionType));
const listFields = ["options", "matchPairs", "gridRows", "gridColumns", "blanks"] as const;

function normalizeList(value: unknown, field: string): Record<string, unknown>[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const normalized: Record<string, unknown>[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return null;
    normalized.push(entry);
  }
  return normalized;
}

function validOrderIndex(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(request, ["INSTRUCTOR", "ADMIN"]);
  if (isAuthFailure(auth)) return auth.response;
  const { id: examId } = await params;
  const body = await readJson(request);
  if (!isRecord(body)) return jsonError("Request body must be a JSON object.", 400);

  const { type, text, points, orderIndex } = body;
  if (typeof type !== "string" || !questionTypes.has(type)) return jsonError("Unsupported question type.", 400);
  if (!isNonEmptyString(text)) return jsonError("text is required.", 400);
  if (points !== undefined && (typeof points !== "number" || !Number.isFinite(points) || points <= 0)) {
    return jsonError("points must be a positive number.", 400);
  }
  if (orderIndex !== undefined && !validOrderIndex(orderIndex)) {
    return jsonError("orderIndex must be a non-negative integer.", 400);
  }

  const nested: Record<(typeof listFields)[number], Record<string, unknown>[] | null> = {
    options: normalizeList(body.options, "options"),
    matchPairs: normalizeList(body.matchPairs, "matchPairs"),
    gridRows: normalizeList(body.gridRows, "gridRows"),
    gridColumns: normalizeList(body.gridColumns, "gridColumns"),
    blanks: normalizeList(body.blanks, "blanks"),
  };
  for (const field of listFields) {
    if (nested[field] === null) return jsonError(`${field} must be an array of objects.`, 400);
  }
  const options = nested.options!;
  const matchPairs = nested.matchPairs!;
  const gridRows = nested.gridRows!;
  const gridColumns = nested.gridColumns!;
  const blanks = nested.blanks!;

  for (const option of options) {
    if (!isNonEmptyString(option.text) || (option.isCorrect !== undefined && typeof option.isCorrect !== "boolean") ||
        (option.orderIndex !== undefined && !validOrderIndex(option.orderIndex))) {
      return jsonError("Each option needs text and may include isCorrect and orderIndex.", 400);
    }
  }
  for (const pair of matchPairs) {
    if (!isNonEmptyString(pair.leftText) || !isNonEmptyString(pair.rightText) ||
        (pair.orderIndex !== undefined && !validOrderIndex(pair.orderIndex))) {
      return jsonError("Each match pair needs leftText and rightText.", 400);
    }
  }
  for (const row of gridRows) {
    if (!isNonEmptyString(row.text) || (row.orderIndex !== undefined && !validOrderIndex(row.orderIndex))) {
      return jsonError("Each grid row needs text.", 400);
    }
  }
  for (const column of gridColumns) {
    if (!isNonEmptyString(column.text) || (column.orderIndex !== undefined && !validOrderIndex(column.orderIndex))) {
      return jsonError("Each grid column needs text.", 400);
    }
  }
  for (const blank of blanks) {
    if (!isNonEmptyString(blank.blankIdentifier) || !Array.isArray(blank.acceptedAnswers) ||
        blank.acceptedAnswers.length === 0 || !blank.acceptedAnswers.every(isNonEmptyString) ||
        (blank.orderIndex !== undefined && !validOrderIndex(blank.orderIndex))) {
      return jsonError("Each blank needs a blankIdentifier and non-empty acceptedAnswers.", 400);
    }
  }

  const kind = type as QuestionType;
  if ((kind === QuestionType.MULTIPLE_CHOICE || kind === QuestionType.CHECKBOX || kind === QuestionType.DROPDOWN) && options.length < 2) {
    return jsonError(`${kind} requires at least two options.`, 400);
  }
  if ((kind === QuestionType.MULTIPLE_CHOICE || kind === QuestionType.DROPDOWN) && options.filter((o) => o.isCorrect === true).length !== 1) {
    return jsonError(`${kind} requires exactly one correct option.`, 400);
  }
  if (kind === QuestionType.CHECKBOX && !options.some((o) => o.isCorrect === true)) {
    return jsonError("CHECKBOX requires at least one correct option.", 400);
  }
  if (kind === QuestionType.MATCH && matchPairs.length < 2) return jsonError("MATCH requires at least two pairs.", 400);
  if ((kind === QuestionType.DRAG_DROP || kind === QuestionType.FILL_IN) && blanks.length === 0) {
    return jsonError(`${kind} requires at least one blank.`, 400);
  }
  if (kind === QuestionType.GRID_MULTIPLE || kind === QuestionType.GRID_CHECKBOX) {
    if (gridRows.length === 0 || gridColumns.length === 0 || options.length === 0) {
      return jsonError(`${kind} requires rows, columns, and options encoding correct cells as "rowText=columnText".`, 400);
    }
    const cells = options.map((option) => option.text as string);
    const allowed = new Set(gridRows.flatMap((row) => gridColumns.map((column) => `${row.text}=${column.text}`)));
    if (cells.some((cell) => !allowed.has(cell)) || new Set(cells).size !== cells.length || options.some((option) => option.isCorrect !== true)) {
      return jsonError("Grid options must be unique valid rowText=columnText cells with isCorrect true.", 400);
    }
  }
  if (kind === QuestionType.SHORT_ANSWER && blanks.length === 0) {
    return jsonError("SHORT_ANSWER requires a blank with acceptedAnswers.", 400);
  }

  try {
    const exam = await prisma.exam.findUnique({ where: { id: examId }, select: { id: true } });
    if (!exam) return jsonError("Exam not found.", 404);
    const owner = await prisma.exam.findUnique({ where: { id: examId }, select: { createdById: true } });
    if (auth.user.role !== "ADMIN" && owner?.createdById !== auth.user.id) return jsonError("Exam not found.", 404);

    const nextIndex = orderIndex === undefined
      ? (((await prisma.question.aggregate({ where: { examId }, _max: { orderIndex: true } }))._max.orderIndex ?? -1) + 1)
      : Number(orderIndex);

    const question = await prisma.question.create({
      data: {
        examId,
        type: kind,
        text: text.trim(),
        points: typeof points === "number" ? points : 1,
        orderIndex: nextIndex,
        options: options.length ? { create: options.map((option, index) => ({
          text: (option.text as string).trim(),
          isCorrect: option.isCorrect === true,
          orderIndex: typeof option.orderIndex === "number" ? option.orderIndex : index,
        })) } : undefined,
        matchPairs: matchPairs.length ? { create: matchPairs.map((pair, index) => ({
          leftText: (pair.leftText as string).trim(),
          rightText: (pair.rightText as string).trim(),
          orderIndex: typeof pair.orderIndex === "number" ? pair.orderIndex : index,
        })) } : undefined,
        gridRows: gridRows.length ? { create: gridRows.map((row, index) => ({
          text: (row.text as string).trim(),
          orderIndex: typeof row.orderIndex === "number" ? row.orderIndex : index,
        })) } : undefined,
        gridColumns: gridColumns.length ? { create: gridColumns.map((column, index) => ({
          text: (column.text as string).trim(),
          orderIndex: typeof column.orderIndex === "number" ? column.orderIndex : index,
        })) } : undefined,
        blanks: blanks.length ? { create: blanks.map((blank, index) => ({
          blankIdentifier: (blank.blankIdentifier as string).trim(),
          acceptedAnswers: (blank.acceptedAnswers as string[]).map((answer) => answer.trim()),
          orderIndex: typeof blank.orderIndex === "number" ? blank.orderIndex : index,
        })) } : undefined,
      },
      include: {
        options: { orderBy: { orderIndex: "asc" } },
        matchPairs: { orderBy: { orderIndex: "asc" } },
        gridRows: { orderBy: { orderIndex: "asc" } },
        gridColumns: { orderBy: { orderIndex: "asc" } },
        blanks: { orderBy: { orderIndex: "asc" } },
      },
    });

    return Response.json({ question }, { status: 201 });
  } catch {
    return jsonError("Unable to create question.", 500);
  }
}
