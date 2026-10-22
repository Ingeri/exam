import { QuestionType } from "@prisma/client";
import type { Prisma } from "@prisma/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const include = { options: true, matchPairs: true, blanks: true, gridRows: true, gridColumns: true } as const;
export type GradingQuestion = Prisma.QuestionGetPayload<{ include: typeof include }>;

export type GradeResult = {
  correct: boolean | null;
  pointsEarned: number | null;
  requiresManualReview: boolean;
};

const sameSet = (left: string[], right: string[]) =>
  left.length === right.length && new Set(left).size === left.length &&
  left.every((value) => right.includes(value));

function answerText(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function normalizeBlankAnswer(value: unknown, question: GradingQuestion): Record<string, unknown> | null {
  if (typeof value === "string" && question.blanks.length === 1) {
    return { [question.blanks[0].blankIdentifier]: value };
  }
  return isRecord(value) ? value : null;
}

function gradeBlanks(value: unknown, question: GradingQuestion): boolean {
  const answers = normalizeBlankAnswer(value, question);
  if (!answers || question.blanks.length === 0) return false;
  const keys = new Set(question.blanks.flatMap((blank) => [blank.blankIdentifier, blank.id]));
  const provided = Object.keys(answers);
  if (provided.length !== question.blanks.length || provided.some((key) => !keys.has(key))) return false;
  return question.blanks.every((blank) => {
    const response = answerText(answers[blank.blankIdentifier] ?? answers[blank.id]);
    return response !== null && blank.acceptedAnswers.some((accepted) => accepted.trim().toLowerCase() === response.toLowerCase());
  });
}

function gradeMatch(value: unknown, question: GradingQuestion): boolean {
  if (!isRecord(value) || question.matchPairs.length === 0) return false;
  const keys = new Set(question.matchPairs.flatMap((pair) => [pair.id, pair.leftText]));
  const provided = Object.keys(value);
  if (provided.length !== question.matchPairs.length || provided.some((key) => !keys.has(key))) return false;
  return question.matchPairs.every((pair) => {
    const response = value[pair.leftText] ?? value[pair.id];
    return response === pair.rightText || response === pair.id;
  });
}

function gradeGrid(value: unknown, question: GradingQuestion): boolean {
  if (!isRecord(value) || question.gridRows.length === 0 || question.gridColumns.length === 0) return false;
  const rows = new Map(question.gridRows.flatMap((row) => [[row.id, row.text], [row.text, row.text]]));
  const columns = new Map(question.gridColumns.flatMap((column) => [[column.id, column.text], [column.text, column.text]]));
  const expected = question.options.filter((option) => option.isCorrect).map((option) => option.text);
  const actual: string[] = [];

  for (const [rowKey, rawSelection] of Object.entries(value)) {
    const rowText = rows.get(rowKey);
    if (!rowText) return false;
    const selections = Array.isArray(rawSelection) ? rawSelection : [rawSelection];
    if (question.type === QuestionType.GRID_MULTIPLE && (selections.length !== 1 || Array.isArray(rawSelection))) return false;
    if (!selections.every((selection) => typeof selection === "string")) return false;
    for (const selection of selections as string[]) {
      const columnText = columns.get(selection);
      if (!columnText) return false;
      actual.push(`${rowText}=${columnText}`);
    }
  }

  return Object.keys(value).length === question.gridRows.length && sameSet(actual, expected);
}

export function gradeAnswer(value: unknown, question: GradingQuestion): GradeResult {
  if (question.type === QuestionType.LONG_ANSWER) {
    const response = answerText(value);
    return response
      ? { correct: null, pointsEarned: null, requiresManualReview: true }
      : { correct: false, pointsEarned: 0, requiresManualReview: false };
  }

  let correct = false;
  switch (question.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.DROPDOWN:
      correct = typeof value === "string" && question.options.some((option) => option.id === value && option.isCorrect);
      break;
    case QuestionType.CHECKBOX:
      correct = Array.isArray(value) && value.every((item) => typeof item === "string") &&
        sameSet(value as string[], question.options.filter((option) => option.isCorrect).map((option) => option.id));
      break;
    case QuestionType.MATCH:
      correct = gradeMatch(value, question);
      break;
    case QuestionType.DRAG_DROP:
    case QuestionType.FILL_IN:
      correct = gradeBlanks(value, question);
      break;
    case QuestionType.SHORT_ANSWER: {
      const response = answerText(value);
      correct = response !== null && question.blanks.some((blank) => blank.acceptedAnswers.includes(response));
      break;
    }
    case QuestionType.GRID_MULTIPLE:
    case QuestionType.GRID_CHECKBOX:
      correct = gradeGrid(value, question);
      break;
  }

  return { correct, pointsEarned: correct ? question.points : 0, requiresManualReview: false };
}

export function hasValidAnswerShape(value: unknown, question: GradingQuestion): boolean {
  switch (question.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.DROPDOWN:
    case QuestionType.SHORT_ANSWER:
    case QuestionType.LONG_ANSWER:
      return typeof value === "string";
    case QuestionType.CHECKBOX:
      return Array.isArray(value) && value.every((item) => typeof item === "string");
    case QuestionType.MATCH:
      return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
    case QuestionType.DRAG_DROP:
    case QuestionType.FILL_IN:
      return (typeof value === "string" && question.blanks.length === 1) ||
        (isRecord(value) && Object.values(value).every((item) => typeof item === "string"));
    case QuestionType.GRID_MULTIPLE:
      return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
    case QuestionType.GRID_CHECKBOX:
      return isRecord(value) && Object.values(value).every((item) =>
        Array.isArray(item) && item.every((cell) => typeof cell === "string"));
  }
}
