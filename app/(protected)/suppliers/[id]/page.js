"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, fmtDate } from "../../../../lib/theme";
import { getSupplierBalance, balanceDirection, fetchCustomOperations } from "../../../../lib/dataHelpers";
import { generateStatementPDF } from "../../../../lib/pdfGenerator";

export default function SupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [customOps, setCustomOps] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("suppliers").select("*").eq("id", id).single();
      const { data: p } = await supabase
        .from("purchases").select("*, products(name)")
        .eq("supplier_id", id).order("date", { ascending: false });
      const ops = await fetchCustomOperations("supplier", id);
      const b = await getSupplierBalance(id);
      setSupplier(s);
      setPurchases(p || []);
      setCustomOps(ops);
      setBalance(b);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>;
  if (!supplier) return <div style={{ color: COLORS.red }}>المورد غير موجود.</div>;

  const dir = balanceDirection(true, balance.balance);

  const timeline = [
    ...purchases.map((p) => ({ kind: "purchase", date: p.date, data: p })),
    ...customOps.map((o) => ({ kind: "custom", date: o.date, data: o })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  async function downloadPDF() {
    setPdfLoading(true);
    try {
      const items = timeline.map((item) =>
        item.kind === "purchase"
          ? { date: item.data.date, description: `${item.data.products?.name || "ديزل"} — ${item.data.description || ""}`, amount: item.data.amount, effect: 1 }
          : { date: item.data.date, description: `${item.data.type_name} — ${item.data.description || ""}`, amount: item.data.amount, effect: item.data.effect }
      );
      await generateStatementPDF({
        partyName: supplier.name,
        partyLabel: "Supplier / المورد",
        items,
        totalDue: balance.totalAmount + balance.opening + balance.customOpsEffect,
        totalPaid: balance.paidInPurchases + balance.totalPayments,
        balanceText: dir.text,
        balanceAmount: dir.amount,
      });
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 4 }}>{supplier.name}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: COLORS.textDim }}>
          صفحة المورد {supplier.default_price ? `· السعر الثابت: ${supplier.default_price}` : ""}
        </div>
        <button
          onClick={downloadPDF}
          disabled={pdfLoading}
          style={{ background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: pdfLoading ? 0.6 : 1 }}
        >
          {pdfLoading ? "⏳ جاري التجهيز…" : "📄 تحميل PDF"}
        </button>
      </div>

      <div style={{ background: COLORS.panel, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>إجمالي المشتريات</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: COLORS.text }}>{money(balance.totalAmount + balance.opening + balance.customOpsEffect)}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>المدفوع</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>{money(balance.paidInPurchases + balance.totalPayments)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: dir.icon === "🔴" ? COLORS.red : "#3EBD8C" }}>
          {dir.icon} {dir.text}{dir.amount ? `: ${money(dir.amount)}` : ""}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: COLORS.text }}>العمليات</h2>
      {timeline.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>لا توجد عمليات بعد.</div>
      ) : (
        timeline.map((item) => {
          if (item.kind === "purchase") {
            const p = item.data;
            return (
              <div key={"p" + p.id} style={{ background: COLORS.panel, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <b style={{ color: COLORS.text }}>{fmtDate(p.date)}</b>
                  <span style={{ color: COLORS.textDim }}>{p.products?.name || ""}</span>
                </div>
                <div style={{ color: COLORS.text }}>{p.description || (p.quantity ? `${p.quantity} لتر × ${p.unit_price}` : "")} — {money(p.amount)}</div>
                {p.notes && <div style={{ color: COLORS.textDim, marginTop: 4 }}>{p.notes}</div>}
              </div>
            );
          }
          const o = item.data;
          const isAdd = o.effect > 0;
          return (
            <div key={"c" + o.id} style={{ background: COLORS.panel, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${isAdd ? "#3EBD8C" : COLORS.red}`, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <b style={{ color: COLORS.gold }}>⭐ {o.type_name}</b>
                <span style={{ color: COLORS.textDim }}>{fmtDate(o.date)}</span>
              </div>
              <div style={{ color: isAdd ? "#3EBD8C" : COLORS.red, fontWeight: 700 }}>{isAdd ? "+" : "-"} {money(o.amount)}</div>
              {o.description && <div style={{ color: COLORS.textDim, marginTop: 4 }}>{o.description}</div>}
              {o.reference_number && <div style={{ color: COLORS.textDim, marginTop: 2, fontSize: 11 }}>مرجع: {o.reference_number}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
