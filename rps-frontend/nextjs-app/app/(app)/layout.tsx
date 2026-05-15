import { Suspense } from "react";
import { AppShell } from "@/components/rps/app-shell";
import { requireServerSessionUser } from "@/lib/backend/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireServerSessionUser();

  return <Suspense fallback={<div className="min-h-screen bg-[#f7f3eb]" />}>
    <AppShell>{children}</AppShell>
  </Suspense>;
}
