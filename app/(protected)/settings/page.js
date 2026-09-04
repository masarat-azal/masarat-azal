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
  const [newLocPrice, setNewLocPrice] = useState("");
  const [newOpName, setNewOpName] = useState("");
  const [newOpCode, setNewOpCode] = useState("");
  const [editingType, setEditingType] = useState(null);
  const [editingLoc, setEditingLoc] = useState(null);

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

  async function deleteProduct(id) {
    if (!confirm("حذف هذا الصنف؟")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  async function addLocation() {
    if (!newLocation.trim()) return;
    const keywords = newKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    await supabase.from("locations").insert({
      name: newLocation.trim(),
      keywords,
      unit_price: newLocPrice ? Number(newLocPrice) : null,
    });
    setNewLocation("");
    setNewKeywords("");
    setNewLocPrice("");
    load();
  }

  async function saveLocationEdit() {
    if (!editingLoc) return;
    const keywords = String(editingLoc.keywordsText || "").split(",").map((k) => k.trim()).filter(Boolean);
    await supabase.from("locations").update({
      name: editingLoc.name,
      keywords,
      unit_price: editingLoc.unit_price ? Number(editingLoc.unit_price) : null,
    }).eq("id", editingLoc.id);
    setEditingLoc(null);
    load();
  }

  async function deleteLocation(id) {
    if (!confirm("حذف هذا الموقع؟")) return;
    await supabase.from("locations").delete().eq("id", id);
    load();
  }

  async function saveOpeningBalance() {
    if (!obParty.trim() || !obAmount) return;
    setObMsg("");
    try {
      const party = await ensureParty(obType, obParty.trim());
      await supabase.from("opening_balances").insert({ party_type: obType, party_id: party.id, amount: Number(obAmount) });
      setObMsg("تم الحفظ بنجاح");
      setObParty("");
      setObAmount("");
      load();
    } catch (e) {
      setObMsg("خطأ: " + e.message);
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

  async function saveTypeEdit() {
    if (!editingType) return;
    await updateOperationType(editingType.id, { name: editingType.name, code: editingType.code });
    setEditingType(null);
    load();
  }

  async function deleteOpType(t) {
    if (t.system_key) {
      alert("لا يمكن حذف نوع عملية أساسي — يمكنك تعديل اسمه أو رمزه فقط.");
      return;
    }
    if (!confirm(`حذف نوع العملية "${t.name}"؟`)) return;
    await supabase.from("operation_types").delete().eq("id", t.id);
    load();
  }

  if (loading) return <div style={{ color: COLORS.textDim }}>جاري التحميل...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>الإعدادات</h1>

      <Section title="أنواع العمليات">
        <Hint>الاسم والرمز قابلان للتعديل. الرمز يظهر في بداية رقم كل عملية من هذا النوع.</Hint>
        {opTypes.map((t) => (
          <div key={t.id} style={rowStyle}>
            {editingType?.id === t.id ? (
              <div style={{ display: "flex", gap: 6, width: "100%", alignItems: "center" }}>
                <input value={editingType.name} onChange={(e) => setEditingType({ ...editingType, name: e.target.value })} style={{ ...inputStyle, marginBottom: 0, flex: 2 }} />
                <input value={editingType.code} onChange={(e) => setEditingType({ ...editingType, code: e.target.value.toUpperCase() })} style={{ ...inputStyle, marginBottom: 0, width: 70 }} />
                <button onClick={saveTypeEdit} style={smallBtn}>حفظ</button>
                <button onClick={() => setEditingType(null)} style={smallBtnGhost}>إلغاء</button>
              </div>
            ) : (
              <>
                <span style={{ color: COLORS.text, fontSize: 13 }}>
                  {t.name}
                  {t.system_key ? <span style={{ color: COLORS.textDim, fontSize: 11 }}> (أساسي)</span> : null}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: COLORS.gold, fontWeight: 700, fontSize: 12 }}>{t.code || "—"}</span>
                  <button onClick={() => setEditingType(t)} style={smallBtnGhost}>تعديل</button>
                  {!t.system_key && <button onClick={() => deleteOpType(t)} style={smallBtnDanger}>حذف</button>}
                </span>
              </>
            )}
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newOpName} onChange={(e) => setNewOpName(e.target.value)} placeholder="اسم النوع الجديد" style={{ ...inputStyle, marginBottom: 0, flex: 2 }} />
          <input value={newOpCode} onChange={(e) => setNewOpCode(e.target.value)} placeholder="الرمز" style={{ ...inputStyle, marginBottom: 0, width: 80 }} />
          <button onClick={addOpType} style={btnStyle}>إضافة</button>
        </div>
      </Section>

      <Section title="الأصناف">
        {lists.products.map((p) => (
          <div key={p.id} style={rowStyle}>
            <span style={{ color: COLORS.text, fontSize: 13 }}>{p.name}</span>
            <button onClick={() => deleteProduct(p.id)} style={smallBtnDanger}>حذف</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="اسم الصنف الجديد" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
          <button onClick={addProduct} style={btnStyle}>إضافة</button>
        </div>
      </Section>

      <Section title="المواقع والأسعار">
        <Hint>السعر هنا يُملأ تلقائيًا في بطاقة العملية عند اختيار هذا الموقع. الكلمات المفتاحية تساعد البوت على التعرف على الموقع من السندات.</Hint>
        {lists.locations.map((l) => (
          <div key={l.id} style={{ ...rowStyle, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            {editingLoc?.id === l.id ? (
              <>
                <input value={editingLoc.name} onChange={(e) => setEditingLoc({ ...editingLoc, name: e.target.value })} placeholder="اسم الموقع" style={{ ...inputStyle, marginBottom: 0 }} />
                <input value={editingLoc.keywordsText} onChange={(e) => setEditingLoc({ ...editingLoc, keywordsText: e.target.value })} placeholder="كلمات مفتاحية مفصولة بفاصلة" style={{ ...inputStyle, marginBottom: 0 }} />
                <input value={editingLoc.unit_price ?? ""} onChange={(e) => setEditingLoc({ ...editingLoc, unit_price: e.target.value })} type="number" placeholder="السعر" style={{ ...inputStyle, marginBottom: 0 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={saveLocationEdit} style={{ ...smallBtn, flex: 1 }}>حفظ</button>
                  <button onClick={() => setEditingLoc(null)} style={{ ...smallBtnGhost, flex: 1 }}>إلغاء</button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                <div>
                  <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 700 }}>
                    {l.name}
                    {l.unit_price ? <span style={{ color: COLORS.gold, marginRight: 8 }}>— {l.unit_price} ريال</span> : <span style={{ color: COLORS.red, fontSize: 11, marginRight: 8 }}>(بلا سعر)</span>}
                  </div>
                  {l.keywords?.length ? <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 3 }}>{l.keywords.join(" · ")}</div> : null}
                </div>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditingLoc({ ...l, keywordsText: (l.keywords || []).join(", ") })} style={smallBtnGhost}>تعديل</button>
                  <button onClick={() => deleteLocation(l.id)} style={smallBtnDanger}>حذف</button>
                </span>
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="اسم الموقع" style={inputStyle} />
          <input value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} placeholder="كلمات مفتاحية مفصولة بفاصلة (مثل: Neom, NEOM)" style={inputStyle} />
          <input value={newLocPrice} onChange={(e) => setNewLocPrice(e.target.value)} type="number" placeholder="السعر الفردي لهذا الموقع" style={inputStyle} />
          <button onClick={addLocation} style={{ ...btnStyle, width: "100%", padding: 10 }}>إضافة موقع</button>
        </div>
      </Section>

      <Section title="رصيد افتتاحي">
        <Hint>أدخل قيمة سالبة إن كان الرصيد مستحقًا عليك.</Hint>
        <select value={obType} onChange={(e) => setObType(e.target.value)} style={inputStyle}>
          <option value="customer">عميل</option>
          <option value="supplier">مورد</option>
        </select>
        <input value={obParty} onChange={(e) => setObParty(e.target.value)} placeholder="اسم الطرف" style={inputStyle} />
        <input value={obAmount} onChange={(e) => setObAmount(e.target.value)} placeholder="المبلغ" type="number" style={inputStyle} />
        {obMsg && <div style={{ fontSize: 13, marginBottom: 8, color: COLORS.text }}>{obMsg}</div>}
        <button onClick={saveOpeningBalance} style={{ ...btnStyle, width: "100%", padding: 10 }}>حفظ الرصيد الافتتاحي</button>
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

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 10, lineHeight: 1.6 }}>{children}</div>;
}

const rowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  background: COLORS.panelLight,
  borderRadius: 8,
  marginBottom: 6,
};

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
  padding: "0 18px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
};

const smallBtn = {
  background: COLORS.gold,
  color: COLORS.bg,
  border: "none",
  borderRadius: 6,
  padding: "5px 12px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const smallBtnGhost = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  cursor: "pointer",
};

const smallBtnDanger = {
  background: "transparent",
  border: `1px solid ${COLORS.red}`,
  color: COLORS.red,
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  cursor: "pointer",
};
