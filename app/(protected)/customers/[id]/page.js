"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, fmtDate } from "../../../../lib/theme";
import { getCustomerBalance, balanceDirection, fetchCustomOperations } from "../../../../lib/dataHelpers";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [customOps, setCustomOps] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
      const { data: s } = await supabase
        .from("sales").select("*, locations(name), products(name)")
        .eq("customer_id", id).order("date", { ascending: false });
      const ops = await fetchCustomOperations("customer", id);
      const b = await getCustomerBalance(id);
      setCustomer(c);
      setSales(s || []);
      setCustomOps(ops);
      setBalance(b);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>;
  if (!customer) return <div style={{ color: COLORS.red }}>العميل غير موجود.</div>;

  const dir = balanceDirection(false, balance.balance);

  // دمج المبيعات والعمليات المخصصة في سجل زمني واحد
  const timeline = [
    ...sales.map((s) => ({ kind: "sale", date: s.date, data: s })),
    ...customOps.map((o) => ({ kind: "custom", date: o.date, data: o })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 4 }}>{customer.name}</h1>
      <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 16 }}>صفحة العميل</div>

      <div style={{ background: COLORS.panel, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>إجمالي المستحق</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: COLORS.text }}>{money(balance.totalNet + balance.opening + balance.customOpsEffect)}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>المدفوع</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>{money(balance.paidInSales + balance.totalPayments)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: dir.icon === "🔴" ? COLORS.red : "#3EBD8C" }}>
          {dir.icon} {dir.text}{dir.amount ? `: ${money(dir.amount)}` : ""}
        </div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: COLORS.text }}>العمليات</h2>
      {timeline.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>لا توجد عمليات بعد.</div>
      ) : (
        timeline.map((item, i) => {
          if (item.kind === "sale") {
            const s = item.data;
            return (
              <div key={"s" + s.id} style={{ background: COLORS.panel, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <b style={{ color: COLORS.text }}>{fmtDate(s.date)}</b>
                  <span style={{ color: COLORS.textDim }}>{s.locations?.name || ""}</span>
                </div>
                <div style={{ color: COLORS.text }}>
                  {s.products?.name || "ديزل"} — {s.quantity ? `${s.quantity} لتر × ${s.unit_price}` : ""} = {money(s.net_total)}
                </div>
                {s.notes && <div style={{ color: COLORS.textDim, marginTop: 4 }}>{s.notes}</div>}
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
              <div style={{ color: isAdd ? "#3EBD8C" : COLORS.red, fontWeight: 700 }}>
                {isAdd ? "+" : "-"} {money(o.amount)}
              </div>
              {o.description && <div style={{ color: COLORS.textDim, marginTop: 4 }}>{o.description}</div>}
              {o.reference_number && <div style={{ color: COLORS.textDim, marginTop: 2, fontSize: 11 }}>مرجع: {o.reference_number}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
