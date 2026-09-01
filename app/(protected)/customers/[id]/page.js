"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, fmtDate } from "../../../../lib/theme";
import { getCustomerBalance, balanceDirection } from "../../../../lib/dataHelpers";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
      const { data: s } = await supabase
        .from("sales")
        .select("*, locations(name), products(name)")
        .eq("customer_id", id)
        .order("date", { ascending: false });
      const b = await getCustomerBalance(id);
      setCustomer(c);
      setSales(s || []);
      setBalance(b);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div style={{ color: COLORS.grey }}>جاري التحميل…</div>;
  if (!customer) return <div style={{ color: COLORS.red }}>العميل غير موجود.</div>;

  const dir = balanceDirection(false, balance.balance);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.green, marginBottom: 4 }}>{customer.name}</h1>
      <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 16 }}>صفحة العميل</div>

      <div style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.silver}` }}>
        <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 4 }}>إجمالي المستحق</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{money(balance.totalNet + balance.opening)}</div>
        <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 4 }}>المدفوع</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>{money(balance.paidInSales + balance.totalPayments)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: dir.icon === "🔴" ? COLORS.red : "#2e7d32" }}>
          {dir.icon} {dir.text}
          {dir.amount ? `: ${money(dir.amount)}` : ""}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>العمليات</h2>
      {sales.length === 0 ? (
        <div style={{ color: COLORS.grey }}>لا توجد عمليات بعد.</div>
      ) : (
        sales.map((s) => (
          <div key={s.id} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.silver}`, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <b>{fmtDate(s.date)}</b>
              <span style={{ color: COLORS.grey }}>{s.locations?.name || ""}</span>
            </div>
            <div>
              {s.products?.name || "ديزل"} — {s.quantity ? `${s.quantity} لتر × ${s.unit_price}` : ""} = {money(s.net_total)}
            </div>
            {s.notes && <div style={{ color: COLORS.grey, marginTop: 4 }}>{s.notes}</div>}
          </div>
        ))
      )}
    </div>
  );
}
