"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS } from "../../../lib/theme";
import { fetchLists, ensureParty, fetchOperationTypes, addOperationType } from "../../../lib/dataHelpers";

export default function SettingsPage() {
  const [lists, setLists] = useState({ customers: [], suppliers: [], products: [], locations: [] });
  const [opTypes, setOpTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [newOpType, setNewOpType] = useState("");

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
    if (!newOpType.trim()) return;
    try {
      await addOperationType(newOpType.trim());
      setNewOpType("");
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>الإعدادات</h1>

      <Section title="أنواع العمليات المخصصة">
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 10 }}>
          أضف أي نوع عملية تحتاجه (مثل مرتجع، تعبئة لزبون، أو أي شيء آخر) — سيظهر مباشرة كخيار عند تسجيل "عملية مخصصة".
        </div>
        {opTypes.map((t) => (
          <Chip key={t.id}>{t.name}</Chip>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newOpType} onChange={(e) => setNewOpType(e.target.value)} placeholder="اسم نوع العملية الجديد" style={inputStyle} />
          <button onClick={addOpType} style={btnStyle}>
            إضافة
          </button>
        </div>
      </Section>

      <Section title="الأصناف">
        {lists.products.map((p) => (
          <Chip key={p.id}>{p.name}</Chip>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="صنف جديد" style={inputStyle} />
          <button onClick={addProduct} style={btnStyle}>
            إضافة
          </button>
        </div>
      </Section>

      <Section title="المواقع وكلماتها المفتاحية">
        {lists.locations.map((l) => (
          <div key={l.id} style={{ fontSize: 13, marginBottom: 6, color: COLORS.text }}>
            <b>{l.name}</b>
            {l.keywords?.length ? ` — ${l.keywords.join("، ")}` : ""}
          </div>
        ))}
        <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="اسم الموقع" style={inputStyle} />
        <input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="كلمات مفتاحية مفصولة بفاصلة" style={inputStyle} />
        <button onClick={addLocation} style={{ ...btnStyle, width: "100%" }}>
          إضافة موقع
        </button>
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
        <button onClick={saveOpeningBalance} style={{ ...btnStyle, width: "100%" }}>
          حفظ الرصيد الافتتاحي
        </button>
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
  return (
    <span style={{ display: "inline-block", background: COLORS.panelLight, color: COLORS.text, borderRadius: 20, padding: "5px 12px", fontSize: 12, marginLeft: 6, marginBottom: 6 }}>
      {children}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: `1.5px solid ${COLORS.border}`,
  marginBottom: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: COLORS.panelLight,
  color: COLORS.text,
};

const btnStyle = {
  background: COLORS.gold,
  color: COLORS.bg,
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  fontWeight: 700,
  cursor: "pointer",
};
