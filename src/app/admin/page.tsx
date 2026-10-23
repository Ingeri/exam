import type { Metadata } from "next";
import { AdminDashboard } from "@/app/ui/portal";

export const metadata: Metadata = { title: "Administration · Ingeri Exam" };

export default function AdminPage() {
  return <AdminDashboard />;
}
