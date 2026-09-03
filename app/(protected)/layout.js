"use client";
import React from "react";
import { AuthProvider } from "../../lib/AuthProvider";
import AppShell from "../../components/AppShell";

export default function ProtectedLayout({ children }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
