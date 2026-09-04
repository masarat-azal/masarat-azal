"use client";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthProvider";
import { COLORS } from "../lib/theme";
import FloatingChat from "./FloatingChat";

const NAV = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/customers", label: "العملاء", icon: "👥" },
  { href: "/suppliers", label: "الموردون", icon: "🚚" },
  { href: "/sales", label: "المبيعات", icon: "📈" },
  { href: "/purchases", label: "المشتريات", icon: "📉" },
  { href: "/expenses", label: "المصروفات", icon: "🧾" },
  { href: "/settings", label: "الإعدادات", icon: "⚙️" },
  { href: "/account-settings", label: "إعدادات الحساب", icon: "👤" },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session && pathname !== "/login") {
      router.push("/login");
    }
  }, [loading, session, pathname, router]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textDim }}>
        جاري التحميل…
      </div>
    );
  }

  if (!session) return null;

  const SidebarContent = (
    <>
      <div style={{ padding: "22px 18px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: COLORS.gold }}>مسارات أزل</div>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>Masarat Azal</div>
      </div>
      <div style={{ padding: 12, flex: 1, overflowY: "auto" }}>
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <a
              key={n.href}
              href={n.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                borderRadius: 10,
                marginBottom: 6,
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                background: active ? COLORS.goldSoft : "transparent",
                color: active ? COLORS.gold : COLORS.text,
                borderRight: active ? `3px solid ${COLORS.gold}` : "3px solid transparent",
              }}
            >
              <span style={{ fontSize: 17 }}>{n.icon}</span> {n.label}
            </a>
          );
        })}
      </div>
      <div style={{ padding: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push("/login");
          }}
          style={{ width: "100%", background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px", fontSize: 13, cursor: "pointer" }}
        >
          تسجيل الخروج
        </button>
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex" }}>
      <div className="masarat-sidebar-desktop" style={{ width: 230, background: COLORS.panel, display: "none", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        {SidebarContent}
      </div>

      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }} />}
      <div
        className="masarat-drawer"
        style={{ position: "fixed", top: 0, right: drawerOpen ? 0 : "-260px", width: 230, height: "100vh", background: COLORS.panel, display: "flex", flexDirection: "column", transition: "right 0.25s ease", zIndex: 50 }}
      >
        {SidebarContent}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="masarat-topbar" style={{ display: "none", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "transparent", border: "none", color: COLORS.gold, fontSize: 22, cursor: "pointer" }}>
            ☰
          </button>
          <div style={{ fontWeight: 800, color: COLORS.gold, fontSize: 15 }}>مسارات أزل</div>
        </div>
        <div style={{ padding: 18, maxWidth: 1100, margin: "0 auto" }}>{children}</div>
      </div>

      <FloatingChat />

      <style>{`
        @media (min-width: 860px) {
          .masarat-sidebar-desktop { display: flex !important; }
        }
        @media (max-width: 859px) {
          .masarat-topbar { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
