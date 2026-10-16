"use client";

import { AppShell } from "@/components/AppShell";
import { AdminRoster } from "@/components/AdminRoster";

export default function AdminPage() {
  return (
    <AppShell wide>
      <AdminRoster />
    </AppShell>
  );
}
