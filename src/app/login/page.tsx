import type { Metadata } from "next";
import { LoginForm } from "@/app/ui/portal";

export const metadata: Metadata = { title: "Sign in · Ingeri Exam" };

export default function LoginPage() {
  return <LoginForm />;
}
