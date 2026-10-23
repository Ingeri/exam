import type { Metadata } from "next";
import { StudentLanding } from "@/app/ui/portal";

export const metadata: Metadata = { title: "Student workspace · Ingeri Exam" };

export default function StudentPage() {
  return <StudentLanding />;
}
