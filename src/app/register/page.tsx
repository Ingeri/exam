import type { Metadata } from "next";
import { RegisterForm } from "@/app/ui/portal";

export const metadata: Metadata = { title: "Create account · Ingeri Exam" };

export default function RegisterPage() {
  return <RegisterForm />;
}
