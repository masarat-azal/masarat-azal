"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS, money } from "../../../lib/theme";
import { getCustomerBalance, balanceDirection } from "../../../lib/dataHelpers";

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data: customers } = await supabase.from("customers").select("*").order("name");
    const withBalance = await Promise.all(
      (customers || []).map(async (c) => {
        const b = await getCustomerBalance(c.id);
        return { ...c, ...balanceDirection(false, b.balance) };
      })
    );
    setRows(withBalance);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addCustomer() {
    if (!newName.trim()) return;
    await supabase.from("customers").insert({ name: newName.trim() });
    setNewName(""); setShowAdd(false); load();
  }

  async function tryDelete(e, c) {
    e.preventDefault(); e.stopPropagation();
    const [{ count: salesCount }, { count: payCount }, { count: opsCount }] = await Promise.all([
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("customer_id", c.id),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("party_type", "customer").eq("party_id", c.id),
      supabase.from("custom_operations").select("id", { count: "exact", head: true }).eq("party_type", "customer").eq("party_id", c.id),
    ]);
    const total = (salesCount || 0) + (payCount || 0) + (opsCount || 0);
    if (total > 0) {
      alert(`لا يمكن حذف "${c.name}" — له ${salesCount || 0} عملية بيع، ${payCount || 0} دفعة، ${opsCount || 0} عملية مخصصة.`);
      return;
    }
    if (!confirm(`تأكيد حذف "${c.name}" نهائيًا؟`)) return;
    await supabase.from("customers").delete().eq("id", c.id);
    load();
  }

  const filtered = rows.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold }}>العملاء</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700 }}>+ إضافة</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم..."
        style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${COLORS.border}`, marginBottom: 14, boxSizing: "border-box", background: COLORS.panelLight, color: COLORS.text, fontSize: 14 }}
      />

      {showAdd && (
        <div style={{ background: COLORS.panel, padding: 14, borderRadius: 12, marginBottom: 14, border: `1px solid ${COLORS.border}`, display: "flex", gap: 8 }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم العميل الجديد" style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: COLORS.panelLight, color: COLORS.text }} />
          <button onClick={addCustomer} style={{ background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700 }}>حفظ</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>{search ? "لا نتائج مطابقة." : "لا يوجد عملاء بعد."}</div>
      ) : (
        filtered.map((c) => (
          <a key={c.id} href={`/customers/${c.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.panel, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{c.name}</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{c.icon} {c.text}{c.amount ? `: ${money(c.amount)}` : ""}</div>
            </div>
            <button onClick={(e) => tryDelete(e, c)} style={{ background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>حذف</button>
          </a>
        ))
      )}
    </div>
  );
}
