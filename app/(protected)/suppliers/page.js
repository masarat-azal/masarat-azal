"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS, money } from "../../../lib/theme";
import { getSupplierBalance, balanceDirection } from "../../../lib/dataHelpers";

export default function SuppliersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");
    const withBalance = await Promise.all(
      (suppliers || []).map(async (s) => {
        const b = await getSupplierBalance(s.id);
        return { ...s, ...balanceDirection(true, b.balance) };
      })
    );
    setRows(withBalance);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addSupplier() {
    if (!newName.trim()) return;
    await supabase.from("suppliers").insert({ name: newName.trim(), default_price: newPrice ? Number(newPrice) : null });
    setNewName(""); setNewPrice(""); setShowAdd(false); load();
  }

  async function tryDelete(e, s) {
    e.preventDefault(); e.stopPropagation();
    const [{ count: purchCount }, { count: payCount }, { count: opsCount }] = await Promise.all([
      supabase.from("purchases").select("id", { count: "exact", head: true }).eq("supplier_id", s.id),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("party_type", "supplier").eq("party_id", s.id),
      supabase.from("custom_operations").select("id", { count: "exact", head: true }).eq("party_type", "supplier").eq("party_id", s.id),
    ]);
    const total = (purchCount || 0) + (payCount || 0) + (opsCount || 0);
    if (total > 0) {
      alert(`لا يمكن حذف "${s.name}" — له ${purchCount || 0} عملية شراء، ${payCount || 0} دفعة، ${opsCount || 0} عملية مخصصة.`);
      return;
    }
    if (!confirm(`تأكيد حذف "${s.name}" نهائيًا؟`)) return;
    await supabase.from("suppliers").delete().eq("id", s.id);
    load();
  }

  const filtered = rows.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold }}>الموردون</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700 }}>+ إضافة</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 بحث بالاسم..."
        style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${COLORS.border}`, marginBottom: 14, boxSizing: "border-box", background: COLORS.panelLight, color: COLORS.text, fontSize: 14 }}
      />

      {showAdd && (
        <div style={{ background: COLORS.panel, padding: 14, borderRadius: 12, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم المورد" style={{ width: "100%", padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, marginBottom: 8, boxSizing: "border-box", background: COLORS.panelLight, color: COLORS.text }} />
          <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="السعر الثابت (اختياري)" type="number" style={{ width: "100%", padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, marginBottom: 8, boxSizing: "border-box", background: COLORS.panelLight, color: COLORS.text }} />
          <button onClick={addSupplier} style={{ width: "100%", background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: 10, fontWeight: 700 }}>حفظ</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>{search ? "لا نتائج مطابقة." : "لا يوجد موردون بعد."}</div>
      ) : (
        filtered.map((s) => (
          <a key={s.id} href={`/suppliers/${s.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.panel, borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.border}` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>{s.name}</div>
              <div style={{ fontSize: 13, color: COLORS.textDim, marginTop: 4 }}>{s.icon} {s.text}{s.amount ? `: ${money(s.amount)}` : ""}</div>
            </div>
            <button onClick={(e) => tryDelete(e, s)} style={{ background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>حذف</button>
          </a>
        ))
      )}
    </div>
  );
}
