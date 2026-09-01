"use client";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthProvider";
import { COLORS } from "../lib/theme";

const NAV = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/operations/new", label: "عملية جديدة", icon: "➕" },
  { href: "/customers", label: "العملاء", icon: "👥" },
  { href: "/suppliers", label: "الموردون", icon: "🚚" },
  { href: "/expenses", label: "المصروفات", icon: "🧾" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && !session && pathname !== "/login") {
      router.push("/login");
    }
  }, [loading, session, pathname, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.grey }}>
        جاري التحميل…
      </div>
    );
  }

  if (!session) return null;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.greenLight})`,
          color: "#fff",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>مسارات أزل</div>
          <div style={{ fontSize: 11, opacity: 0.85 }}>Masarat Azal</div>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
        >
          خروج
        </button>
      </div>

      <div style={{ display: "flex", maxWidth: 1100, margin: "0 auto" }}>
        <div className="masarat-sidebar" style={{ width: 200, padding: 16, display: "none" }}>
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderRadius: 10,
                marginBottom: 6,
                fontSize: 14,
                fontWeight: pathname === n.href ? 700 : 500,
                background: pathname === n.href ? "#fff" : "transparent",
                color: pathname === n.href ? COLORS.green : COLORS.text,
                boxShadow: pathname === n.href ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <span>{n.icon}</span> {n.label}
            </a>
          ))}
        </div>

        <div style={{ flex: 1, padding: 16, paddingBottom: 90 }}>{children}</div>
      </div>

      <div
        className="masarat-bottomnav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#fff",
          borderTop: `1px solid ${COLORS.silver}`,
          display: "flex",
          justifyContent: "space-around",
          padding: "8px 4px",
        }}
      >
        {NAV.map((n) => (
          <a
            key={n.href}
            href={n.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontSize: 10,
              color: pathname === n.href ? COLORS.green : COLORS.grey,
              fontWeight: pathname === n.href ? 700 : 500,
              flex: 1,
            }}
          >
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            {n.label}
          </a>
        ))}
      </div>

      <style>{`
        @media (min-width: 860px) {
          .masarat-sidebar { display: block !important; }
          .masarat-bottomnav { display: none !important; }
        }
      `}</style>
    </div>
  );
}
