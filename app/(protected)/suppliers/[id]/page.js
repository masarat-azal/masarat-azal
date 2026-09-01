"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, fmtDate } from "../../../../lib/theme";
import { getSupplierBalance, balanceDirection } from "../../../../lib/dataHelpers";

export default function SupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: s } = await supabase.from("suppliers").select("*").eq("id", id).single();
      const { data: p } = await supabase.from("purchases").select("*, products(name)").eq("supplier_id", id).order("date", { ascending: false });
      const b = await getSupplierBalance(id);
      setSupplier(s);
      setPurchases(p || []);
      setBalance(b);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div style={{ color: COLORS.grey }}>جاري التحميل…</div>;
  if (!supplier) return <div style={{ color: COLORS.red }}>المورد غير موجود.</div>;

  const dir = balanceDirection(true, balance.balance);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.green, marginBottom: 4 }}>{supplier.name}</h1>
      <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 16 }}>
        صفحة المورد {supplier.default_price ? `· السعر الثابت: ${supplier.default_price}` : ""}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.silver}` }}>
        <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 4 }}>إجمالي المشتريات</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{money(balance.totalAmount + balance.opening)}</div>
        <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 4 }}>المدفوع</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>{money(balance.paidInPurchases + balance.totalPayments)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: dir.icon === "🔴" ? COLORS.red : "#2e7d32" }}>
          {dir.icon} {dir.text}
          {dir.amount ? `: ${money(dir.amount)}` : ""}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>العمليات</h2>
      {purchases.length === 0 ? (
        <div style={{ color: COLORS.grey }}>لا توجد عمليات بعد.</div>
      ) : (
        purchases.map((p) => (
          <div key={p.id} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.silver}`, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <b>{fmtDate(p.date)}</b>
              <span style={{ color: COLORS.grey }}>{p.products?.name || ""}</span>
            </div>
            <div>{p.description || (p.quantity ? `${p.quantity} لتر × ${p.unit_price}` : "")} — {money(p.amount)}</div>
            {p.notes && <div style={{ color: COLORS.grey, marginTop: 4 }}>{p.notes}</div>}
          </div>
        ))
      )}
    </div>
  );
}
