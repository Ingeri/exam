import type { Metadata } from "next";
import { InstructorDashboard } from "@/app/ui/portal";

export const metadata: Metadata = { title: "Instructor workspace · Ingeri Exam" };

export default function InstructorPage() {
  return <InstructorDashboard />;
}
