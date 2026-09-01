"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS, money } from "../../../lib/theme";

function Card({ label, value, color }) {
  return (
    <div style={{ background: COLORS.panel, borderRadius: 14, padding: 16, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color || COLORS.text }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: sales }, { data: purchases }, { data: expenses }] = await Promise.all([
          supabase.from("sales").select("net_total,paid,date"),
          supabase.from("purchases").select("amount,paid"),
          supabase.from("expenses").select("amount"),
        ]);
        const totalSales = (sales || []).reduce((s, r) => s + (Number(r.net_total) || 0), 0);
        const paidByCustomers = (sales || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
        const totalPurchases = (purchases || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const paidToSuppliers = (purchases || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
        const totalExpenses = (expenses || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = (sales || []).filter((r) => r.date === today).length;
        setTotals({
          totalSales, receivable: totalSales - paidByCustomers, totalPurchases,
          payable: totalPurchases - paidToSuppliers, totalExpenses,
          netProfit: totalSales - totalPurchases - totalExpenses, todayCount,
        });
      } catch (e) { setError(e.message); } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>لوحة التحكم</h1>
      {error && <div style={{ color: COLORS.red, marginBottom: 12 }}>⚠️ {error}</div>}
      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <a href="/customers" style={cardLink}><span style={{fontSize:22}}>👥</span><div>العملاء</div></a>
            <a href="/suppliers" style={cardLink}><span style={{fontSize:22}}>🚚</span><div>الموردون</div></a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Card label="إجمالي المبيعات" value={money(totals.totalSales)} />
            <Card label="مستحق على العملاء" value={money(totals.receivable)} color={COLORS.red} />
            <Card label="إجمالي المشتريات" value={money(totals.totalPurchases)} />
            <Card label="مستحق للموردين" value={money(totals.payable)} color={COLORS.red} />
            <Card label="إجمالي المصروفات" value={money(totals.totalExpenses)} color={COLORS.red} />
            <Card label="صافي الربح التقديري" value={money(totals.netProfit)} color={COLORS.gold} />
            <Card label="عمليات اليوم" value={totals.todayCount} />
          </div>
        </>
      )}
      <a href="/operations/new" style={{ display: "block", textAlign: "center", marginTop: 20, background: COLORS.gold, color: COLORS.bg, padding: "14px", borderRadius: 12, fontWeight: 700 }}>
        + تسجيل عملية جديدة
      </a>
    </div>
  );
}

const cardLink = { display: "flex", alignItems: "center", gap: 10, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 16, color: COLORS.text, fontWeight: 700 };
