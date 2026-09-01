"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS, money, fmtDate } from "../../../lib/theme";

const CATS = ["مخالفة", "مصروفات عامة", "رواتب", "عمولات"];

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ item_name: "", category: "مصروفات عامة", amount: "", notes: "" });

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("expenses").select("*").order("date", { ascending: false });
    setRows(data || []); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.item_name || !form.amount) return;
    await supabase.from("expenses").insert({ item_name: form.item_name, category: form.category, amount: Number(form.amount), notes: form.notes || null });
    setForm({ item_name: "", category: "مصروفات عامة", amount: "", notes: "" }); setShowAdd(false); load();
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold }}>المصروفات</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700 }}>+ إضافة</button>
      </div>

      <div style={{ background: COLORS.panel, borderRadius: 12, padding: 14, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, color: COLORS.textDim }}>إجمالي المصروفات</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.red }}>{money(total)}</div>
      </div>

      {showAdd && (
        <div style={{ background: COLORS.panel, padding: 14, borderRadius: 12, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
          <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="اسم البند" style={inputStyle} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inputStyle}>
            {CATS.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="المبلغ" type="number" style={inputStyle} />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات (اختياري)" style={inputStyle} />
          <button onClick={save} style={{ width: "100%", background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: 10, fontWeight: 700 }}>حفظ</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={{ background: COLORS.panel, borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b style={{ color: COLORS.text }}>{r.item_name}</b>
              <span style={{ color: COLORS.text }}>{money(r.amount)}</span>
            </div>
            <div style={{ color: COLORS.textDim, marginTop: 4 }}>{fmtDate(r.date)} · {r.category}</div>
          </div>
        ))
      )}
    </div>
  );
}

const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, marginBottom: 8, boxSizing: "border-box", background: COLORS.panelLight, color: COLORS.text };
