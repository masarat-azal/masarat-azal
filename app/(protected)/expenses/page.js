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
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!form.item_name || !form.amount) return;
    await supabase.from("expenses").insert({
      item_name: form.item_name,
      category: form.category,
      amount: Number(form.amount),
      notes: form.notes || null,
    });
    setForm({ item_name: "", category: "مصروفات عامة", amount: "", notes: "" });
    setShowAdd(false);
    load();
  }

  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.green }}>المصروفات</h1>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700 }}>
          + إضافة
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 14, border: `1px solid ${COLORS.silver}` }}>
        <div style={{ fontSize: 13, color: COLORS.grey }}>إجمالي المصروفات</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.red }}>{money(total)}</div>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", padding: 14, borderRadius: 12, marginBottom: 14, border: `1px solid ${COLORS.silver}` }}>
          <input value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} placeholder="اسم البند" style={inputStyle} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle }}>
            {CATS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="المبلغ" type="number" style={inputStyle} />
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات (اختياري)" style={inputStyle} />
          <button onClick={save} style={{ width: "100%", background: COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: 10, fontWeight: 700 }}>
            حفظ
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.grey }}>جاري التحميل…</div>
      ) : (
        rows.map((r) => (
          <div key={r.id} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${COLORS.silver}`, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <b>{r.item_name}</b>
              <span>{money(r.amount)}</span>
            </div>
            <div style={{ color: COLORS.grey, marginTop: 4 }}>
              {fmtDate(r.date)} · {r.category}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: `1.5px solid ${COLORS.silver}`,
  marginBottom: 8,
  boxSizing: "border-box",
};
