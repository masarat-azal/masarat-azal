"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS } from "../../../lib/theme";
import { fetchLists, ensureParty, fetchOperationTypes, addOperationType, updateOperationType } from "../../../lib/dataHelpers";

export default function SettingsPage() {
  const [lists, setLists] = useState({ customers: [], suppliers: [], products: [], locations: [] });
  const [opTypes, setOpTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newOpName, setNewOpName] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [editingType, setEditingType] = useState(null);

  const [obParty, setObParty] = useState("");
  const [obType, setObType] = useState("customer");
  const [obAmount, setObAmount] = useState("");
  const [obMsg, setObMsg] = useState("");

  async function load() {
    setLoading(true);
    const [l, ops] = await Promise.all([fetchLists(), fetchOperationTypes()]);
    setLists(l);
    setOpTypes(ops);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function addProduct() {
    if (!newProduct.trim()) return;
    await supabase.from("products").insert({ name: newProduct.trim(), behavior: "qty_price" });
    setNewProduct("");
    load();
  }
  async function addLocation() {
    if (!newLocation.trim()) return;
    const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    await supabase.from("locations").insert({ name: newLocation.trim(), keywords });
    setNewLocation("");
    setNewKeywords("");
    load();
  }
  async function saveOpeningBalance() {
    if (!obParty.trim() || !obAmount) return;
    setObMsg("");
    try {
      const party = await ensureParty(obType, obParty.trim());
      await supabase.from("opening_balances").insert({ party_type: obType, party_id: party.id, amount: Number(obAmount) });
      setObMsg("✅ تم الحفظ");
      setObParty("");
      setObAmount("");
      load();
    } catch (e) {
      setObMsg("⚠️ " + e.message);
    }
  }
  async function addOpType() {
    if (!newOpName.trim() || !newOpCode.trim()) return;
    try {
      await addOperationType(newOpName.trim(), newOpCode.trim().toUpperCase());
      setNewOpName("");
      setNewOpCode("");
      load();
    } catch (e) {
      alert(e.message);
    }
  }
  async function saveEdit() {
    if (!editingType) return;
    await updateOperationType(editingType.id, { name: editingType.name, code: editingType.code });
    setEditingType(null);
    load();
  }

  return (
    <div dir="rtl">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>الإعدادات</h1>

      <Section title="أنواع العمليات (الأساسية والمخصصة) — الاسم والرمز قابلان للتعديل">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>الرمز يُستخدم في بداية رقم كل عملية من هذا النوع.</div>
        {opTypes.map((t) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: COLORS.panelLight, borderRadius: 8, marginBottom: 6 }}>
            {editingType?.id === t.id ? (
              <>
                <input value={editingType.name} onChange={(e) => setEditingType({ ...editingType, name: e.target.value })} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                <input value={editingType.code} onChange={(e) => setEditingType({ ...editingType, code: e.target.value.toUpperCase() })} style={{ ...inputStyle, marginBottom: 0, width: 60, marginLeft: 6 }} />
                <button onClick={saveEdit} style={{ ...btnStyle, marginLeft: 6 }}>حفظ</button>
              </>
            ) : (
              <>
                <span style={{ color: COLORS.text, fontSize: 13 }}>{t.name} {t.system_key ? <small style={{ color: COLORS.textDim }}>(أساسي)</small> : null}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: 12 }}>{t.code}</span>
                  <button onClick={() => setEditingType(t)} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>تعديل</button>
                </span>
              </>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="اسم نوع عملية جديد (مثل: مرتجع)" style={{ ...inputStyle, marginBottom: 0, flex: 2 }} />
          <input value={newOpCode} onChange={(e) => setNewOpCode(e.target.value)} placeholder="الرمز (مثل R)" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button onClick={addOpType} style={btnStyle}>إضافة</button>
        </div>
      </Section>

      <Section title="الأصناف">
        {lists.products.map((p) => <Chip key={p.id}>{p.name}</Chip>)}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="صنف جديد" style={inputStyle} />
          <button onClick={addProduct} style={btnStyle}>إضافة</button>
        </div>
      </Section>

      <Section title="المواقع وكلماتها المفتاحية">
        {lists.locations.map((l) => (
          <div key={l.id} style={{ fontSize: 13, marginBottom: 6, color: COLORS.text }}>
            <b>{l.name}</b>{l.keywords?.length ? ` — ${l.keywords.join("، ")}` : ""}
          </div>
        ))}
        <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="اسم الموقع" style={inputStyle} />
        <input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="كلمات مفتاحية مفصولة بفاصلة" style={inputStyle} />
        <button onClick={addLocation} style={{ ...btnStyle, width: "100%" }}>إضافة موقع</button>
      </Section>

      <Section title="رصيد افتتاحي">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>أدخل قيمة سالبة إن كان الرصيد مستحقًا عليك.</div>
        <select value={obType} onChange={(e) => setObType(e.target.value)} style={inputStyle}>
          <option value="customer">عميل</option>
          <option value="supplier">مورد</option>
        </select>
        <input value={obParty} onChange={(e) => setObParty(e.target.value)} placeholder="اسم الطرف" style={inputStyle} />
        <input value={obAmount} onChange={(e) => setObAmount(e.target.value)} placeholder="المبلغ" type="number" style={inputStyle} />
        {obMsg && <div style={{ fontSize: 13, marginBottom: 8, color: COLORS.text }}>{obMsg}</div>}
        <button onClick={saveOpeningBalance} style={{ ...btnStyle, width: "100%" }}>حفظ الرصيد الافتتاحي</button>
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: COLORS.panel, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.gold, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}
function Chip({ children }) {
  return <span style={{ display: "inline-block", background: COLORS.panelLight, color: COLORS.text, borderRadius: 20, padding: "5px 12px", fontSize: 12, marginLeft: 6, marginBottom: 6 }}>{children}</span>;
}
const inputStyle = { width: "100%", padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.border}`, marginBottom: 8, boxSizing: "border-box", fontSize: 14, background: COLORS.panelLight, color: COLORS.text };
const btnStyle = { background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700, cursor: "pointer" };
