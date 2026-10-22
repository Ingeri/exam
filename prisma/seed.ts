import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const questions = [
  {
    type: "MULTIPLE_CHOICE" as const,
    text: "Which planet is known as the Red Planet?",
    points: 1,
    orderIndex: 0,
    options: { create: [
      { text: "Venus", isCorrect: false, orderIndex: 0 },
      { text: "Mars", isCorrect: true, orderIndex: 1 },
      { text: "Jupiter", isCorrect: false, orderIndex: 2 },
    ] },
  },
  {
    type: "CHECKBOX" as const,
    text: "Select the prime numbers.",
    points: 2,
    orderIndex: 1,
    options: { create: [
      { text: "2", isCorrect: true, orderIndex: 0 },
      { text: "4", isCorrect: false, orderIndex: 1 },
      { text: "7", isCorrect: true, orderIndex: 2 },
    ] },
  },
  {
    type: "DRAG_DROP" as const,
    text: "Complete: The capital of Rwanda is __city__.",
    points: 1,
    orderIndex: 2,
    blanks: { create: [{ blankIdentifier: "city", acceptedAnswers: ["Kigali"], orderIndex: 0 }] },
  },
  {
    type: "SHORT_ANSWER" as const,
    text: "What is 6 multiplied by 7?",
    points: 1,
    orderIndex: 3,
    blanks: { create: [{ blankIdentifier: "answer", acceptedAnswers: ["42"], orderIndex: 0 }] },
  },
  { type: "LONG_ANSWER" as const, text: "Explain one benefit of renewable energy.", points: 5, orderIndex: 4 },
  {
    type: "DROPDOWN" as const,
    text: "Water freezes at __temperature__ degrees Celsius.",
    points: 1,
    orderIndex: 5,
    options: { create: [
      { text: "0", isCorrect: true, orderIndex: 0 },
      { text: "10", isCorrect: false, orderIndex: 1 },
      { text: "100", isCorrect: false, orderIndex: 2 },
    ] },
    blanks: { create: [{ blankIdentifier: "temperature", acceptedAnswers: ["0"], orderIndex: 0 }] },
  },
  {
    type: "MATCH" as const,
    text: "Match each element to its chemical symbol.",
    points: 2,
    orderIndex: 6,
    matchPairs: { create: [
      { leftText: "Oxygen", rightText: "O", orderIndex: 0 },
      { leftText: "Hydrogen", rightText: "H", orderIndex: 1 },
    ] },
  },
  {
    type: "FILL_IN" as const,
    text: "The largest ocean is the __ocean__ Ocean.",
    points: 1,
    orderIndex: 7,
    blanks: { create: [{ blankIdentifier: "ocean", acceptedAnswers: ["Pacific"], orderIndex: 0 }] },
  },
  {
    type: "GRID_MULTIPLE" as const,
    text: "Choose the correct classification for each item.",
    points: 2,
    orderIndex: 8,
    gridRows: { create: [
      { text: "Whale", orderIndex: 0 },
      { text: "Eagle", orderIndex: 1 },
    ] },
    gridColumns: { create: [
      { text: "Mammal", orderIndex: 0 },
      { text: "Bird", orderIndex: 1 },
    ] },
    options: { create: [
      { text: "Whale=Mammal", isCorrect: true, orderIndex: 0 },
      { text: "Eagle=Bird", isCorrect: true, orderIndex: 1 },
    ] },
  },
  {
    type: "GRID_CHECKBOX" as const,
    text: "Select all properties that apply to each number.",
    points: 2,
    orderIndex: 9,
    gridRows: { create: [
      { text: "2", orderIndex: 0 },
      { text: "9", orderIndex: 1 },
    ] },
    gridColumns: { create: [
      { text: "Even", orderIndex: 0 },
      { text: "Odd", orderIndex: 1 },
      { text: "Prime", orderIndex: 2 },
    ] },
    options: { create: [
      { text: "2=Even", isCorrect: true, orderIndex: 0 },
      { text: "2=Prime", isCorrect: true, orderIndex: 1 },
      { text: "9=Odd", isCorrect: true, orderIndex: 2 },
    ] },
  },
];

async function main() {
  const instructor = await prisma.user.upsert({
    where: { email: "seed.instructor@example.com" },
    update: { name: "Sample Instructor", role: "INSTRUCTOR" },
    create: { name: "Sample Instructor", email: "seed.instructor@example.com", role: "INSTRUCTOR" },
  });

  const existing = await prisma.exam.findFirst({
    where: { title: "Comprehensive Question Types Sample", createdById: instructor.id },
    select: { id: true },
  });

  if (existing) await prisma.exam.delete({ where: { id: existing.id } });

  const exam = await prisma.exam.create({
    data: {
      title: "Comprehensive Question Types Sample",
      description: "A sample exam covering all supported question types.",
      durationMinutes: 45,
      passingScore: 70,
      status: "PUBLISHED",
      createdById: instructor.id,
      questions: { create: questions },
    },
    include: { _count: { select: { questions: true } } },
  });

  console.log(`Seeded exam ${exam.id} with ${exam._count.questions} questions.`);
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
