"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, num } from "../../../../lib/theme";
import { fetchLists, ensureParty, ensureProduct, findByName, fetchOperationTypes, uploadDocument } from "../../../../lib/dataHelpers";

const OP_TYPES = [
  { key: "بيع", label: "بيع", emoji: "🟢" },
  { key: "شراء", label: "شراء", emoji: "🟤" },
  { key: "دفعة_من_عميل", label: "دفعة من عميل", emoji: "🔵" },
  { key: "دفعة_لمورد", label: "دفعة لمورد", emoji: "🔵" },
  { key: "مصروف", label: "مصروف", emoji: "🧾" },
];

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "9px 10px",
          borderRadius: 8,
          border: `1.5px solid ${COLORS.border}`,
          fontSize: 14,
          boxSizing: "border-box",
          outline: "none",
          background: COLORS.panelLight,
          color: COLORS.text,
        }}
      />
    </label>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyDraft(type) {
  return {
    type,
    party_name: "",
    date: new Date().toISOString().slice(0, 10),
    location_name: "",
    product_name: "ديزل",
    quantity: null,
    unit_price: null,
    amount: null,
    fees: null,
    invoice_number: "",
    notes: "",
    missing: [],
  };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return "d" + Date.now() + "-" + idCounter;
}

export default function NewOperationPage() {
  const [screen, setScreen] = useState("home");
  const [lists, setLists] = useState({ customers: [], suppliers: [], products: [], locations: [] });
  const [opTypes, setOpTypes] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [listError, setListError] = useState("");

  const [aiText, setAiText] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [items, setItems] = useState([]); // كل عنصر: { id, draft, file, status, errorMsg }
  const fileInputRef = useRef(null);

  const [custom, setCustom] = useState({
    type_name: "",
    party_type: "customer",
    party_name: "",
    effect: 1,
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    reference_number: "",
  });
  const [customSaving, setCustomSaving] = useState(false);
  const [customError, setCustomError] = useState("");
  const [customDone, setCustomDone] = useState("");

  const load = useCallback(async () => {
    setLoadingLists(true);
    setListError("");
    try {
      const [l, ops] = await Promise.all([fetchLists(), fetchOperationTypes()]);
      setLists(l);
      setOpTypes(ops);
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function callAI(payloadExtra) {
    const res = await fetch("/api/ai-parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customers: lists.customers.map((c) => c.name),
        suppliers: lists.suppliers.map((s) => s.name),
        products: lists.products.map((p) => p.name),
        locations: lists.locations.map((l) => l.name),
        ...payloadExtra,
      }),
    });
    const parsed = await res.json();
    if (!res.ok) throw new Error(parsed.error || "خطأ غير معروف");
    return parsed;
  }

  async function runTextAI() {
    if (!aiText.trim()) return;
    setBatchLoading(true);
    setBatchProgress("⏳ جاري التحليل…");
    try {
      const parsed = await callAI({ text: aiText });
      const draft = { ...emptyDraft(parsed.type === "غير_مفهوم" ? "بيع" : parsed.type), ...parsed, missing: parsed.missing || [] };
      setItems((prev) => [...prev, { id: nextId(), draft, file: null, status: "review", errorMsg: parsed.type === "غير_مفهوم" ? "لم يفهم النص بوضوح — راجع الحقول يدويًا." : "" }]);
      setAiText("");
      setScreen("batch");
    } catch (e) {
      alert(e.message);
    } finally {
      setBatchLoading(false);
      setBatchProgress("");
    }
  }

  async function handleFilesSelected(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBatchLoading(true);
    const newItems = [];
    for (let i = 0; i < files.length; i++) {
      setBatchProgress(`⏳ تحليل الملف ${i + 1} من ${files.length}…`);
      const file = files[i];
      try {
        const base64 = await fileToBase64(file);
        const parsed = await callAI({ image: base64, mimeType: file.type });
        const draft = { ...emptyDraft(parsed.type === "غير_مفهوم" ? "بيع" : parsed.type), ...parsed, missing: parsed.missing || [] };
        newItems.push({
          id: nextId(),
          draft,
          file,
          status: "review",
          errorMsg: parsed.type === "غير_مفهوم" ? "لم يستطع الذكاء الاصطناعي فهم هذا الملف بوضوح — راجع الحقول يدويًا أو احذفه." : "",
        });
      } catch (err) {
        newItems.push({ id: nextId(), draft: emptyDraft("بيع"), file, status: "review", errorMsg: "تعذر تحليل هذا الملف: " + err.message });
      }
    }
    setItems((prev) => [...prev, ...newItems]);
    setBatchLoading(false);
    setBatchProgress("");
    setScreen("batch");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function startManual(type) {
    setItems((prev) => [...prev, { id: nextId(), draft: emptyDraft(type), file: null, status: "review", errorMsg: "" }]);
    setScreen("batch");
  }

  function updateItemDraft(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, draft: { ...it.draft, [field]: value } } : it)));
  }

  function updateItemType(id, type) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, draft: { ...emptyDraft(type), party_name: it.draft.party_name, date: it.draft.date, amount: it.draft.amount, notes: it.draft.notes } } : it)));
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  async function approveItem(id) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "saving", errorMsg: "" } : it)));
    try {
      const opNumber = await saveOperation(item.draft, lists);
      if (item.file) {
        await uploadDocument(item.file, opNumber, item.file.type);
      }
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "saved" } : it)));
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: "review", errorMsg: e.message } : it)));
    }
  }

  async function saveOperation(draft, lists) {
    const opNumber = `${draft.type === "بيع" ? "S" : draft.type === "شراء" ? "P" : "T"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (draft.type === "بيع") {
      if (!draft.party_name) throw new Error("اسم العميل مطلوب");
      const qty = num(draft.quantity);
      if (qty === null) throw new Error("الكمية مطلوبة");
      const price = num(draft.unit_price) ?? (num(draft.amount) / qty);
      if (price === null || isNaN(price)) throw new Error("السعر أو المبلغ مطلوب");
      const customer = await ensureParty("customer", draft.party_name);
      const product = await ensureProduct(draft.product_name || "ديزل");
      const location = findByName(lists.locations, draft.location_name);
      const g = qty * price;
      const fees = num(draft.fees) || 0;
      const n = g + fees;
      const { error } = await supabase.from("sales").insert({
        op_number: opNumber,
        date: draft.date,
        customer_id: customer.id,
        location_id: location?.id || null,
        product_id: product?.id || null,
        quantity: qty,
        unit_price: price,
        gross_total: g,
        fees,
        net_total: n,
        paid: 0,
        remaining: n,
        invoice_number: draft.invoice_number || null,
        notes: draft.notes || null,
      });
      if (error) throw error;
    } else if (draft.type === "شراء") {
      if (!draft.party_name) throw new Error("اسم المورد مطلوب");
      const qty = num(draft.quantity);
      const price = num(draft.unit_price);
      const amount = num(draft.amount) ?? (qty && price ? qty * price : null);
      if (amount === null) throw new Error("المبلغ أو (الكمية + السعر) مطلوب");
      const supplier = await ensureParty("supplier", draft.party_name);
      const product = await ensureProduct(draft.product_name || "ديزل");
      const { error } = await supabase.from("purchases").insert({
        op_number: opNumber,
        date: draft.date,
        supplier_id: supplier.id,
        description: draft.notes || `شراء ${draft.product_name || ""}`.trim(),
        product_id: product?.id || null,
        quantity: qty,
        unit_price: price,
        amount,
        paid: 0,
        running_balance: amount,
        invoice_number: draft.invoice_number || null,
        notes: draft.notes || null,
      });
      if (error) throw error;
    } else if (draft.type === "دفعة_من_عميل" || draft.type === "دفعة_لمورد") {
      if (!draft.party_name) throw new Error("اسم الطرف مطلوب");
      const amount = num(draft.amount);
      if (amount === null) throw new Error("المبلغ مطلوب");
      const isCustomer = draft.type === "دفعة_من_عميل";
      const party = await ensureParty(isCustomer ? "customer" : "supplier", draft.party_name);
      const { error } = await supabase.from("payments").insert({
        op_number: opNumber,
        date: draft.date,
        party_type: isCustomer ? "customer" : "supplier",
        party_id: party.id,
        payment_type: isCustomer ? "تحصيل" : "سداد",
        amount,
        notes: draft.notes || null,
      });
      if (error) throw error;
    } else if (draft.type === "مصروف") {
      const amount = num(draft.amount);
      if (amount === null) throw new Error("المبلغ مطلوب");
      const { error } = await supabase.from("expenses").insert({
        date: draft.date,
        item_name: draft.notes || "مصروف",
        category: "مصروفات عامة",
        amount,
        notes: draft.notes || null,
      });
      if (error) throw error;
    }
    return opNumber;
  }

  async function saveCustom() {
    setCustomSaving(true);
    setCustomError("");
    try {
      if (!custom.type_name) throw new Error("اختر نوع العملية");
      if (!custom.party_name.trim()) throw new Error("اسم الطرف مطلوب");
      const amount = num(custom.amount);
      if (amount === null) throw new Error("المبلغ مطلوب");
      const party = await ensureParty(custom.party_type, custom.party_name.trim());
      const opNumber = `C-${Date.now()}`;
      const { error } = await supabase.from("custom_operations").insert({
        op_number: opNumber,
        date: custom.date,
        type_name: custom.type_name,
        party_type: custom.party_type,
        party_id: party.id,
        effect: custom.effect,
        amount,
        description: custom.description || null,
        reference_number: custom.reference_number || null,
      });
      if (error) throw error;
      setCustomDone(`تم تسجيل "${custom.type_name}" لـ${custom.party_name} بتأثير ${custom.effect > 0 ? "+" : "-"} ${money(amount)}`);
    } catch (e) {
      setCustomError(e.message);
    } finally {
      setCustomSaving(false);
    }
  }

  function startCustom() {
    setCustom({ type_name: opTypes[0]?.name || "", party_type: "customer", party_name: "", effect: 1, amount: "", date: new Date().toISOString().slice(0, 10), description: "", reference_number: "" });
    setCustomError("");
    setCustomDone("");
    setScreen("custom");
  }

  const btnPrimary = { background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 12, padding: "13px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" };
  const btnGhost = { background: COLORS.panel, color: COLORS.text, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: "13px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer" };

  const pendingCount = items.filter((it) => it.status !== "saved").length;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>عملية جديدة</h1>

      {listError && <div style={{ background: "#3a1f1f", color: COLORS.red, padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 13 }}>⚠️ {listError}</div>}

      {screen === "home" && (
        <>
          <div style={{ background: COLORS.panel, borderRadius: 16, padding: 18, marginBottom: 14, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: COLORS.gold }}>✨ إدخال بالذكاء الاصطناعي</div>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="مثال: اشتريت من محطة النور 20000 لتر ديزل بسعر 1.82"
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`,
                padding: 12,
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
                outline: "none",
                background: COLORS.panelLight,
                color: COLORS.text,
              }}
            />
            <button onClick={runTextAI} disabled={batchLoading || !aiText.trim() || loadingLists} style={{ ...btnPrimary, width: "100%", marginTop: 10, opacity: batchLoading || loadingLists ? 0.6 : 1 }}>
              {batchLoading ? batchProgress || "⏳ جاري المعالجة…" : loadingLists ? "⏳ تحميل البيانات…" : "تحليل واعتماد"}
            </button>

            <div style={{ textAlign: "center", color: COLORS.textDim, fontSize: 12, margin: "12px 0" }}>— أو —</div>

            <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleFilesSelected} style={{ display: "none" }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={batchLoading} style={{ ...btnGhost, width: "100%", borderColor: COLORS.gold, color: COLORS.gold, opacity: batchLoading ? 0.6 : 1 }}>
              📷 رفع صورة أو أكثر (فواتير، إيصالات)
            </button>
            <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6, textAlign: "center" }}>يمكنك اختيار عدة ملفات دفعة واحدة — كل ملف يُحلَّل ويُسجَّل كعملية مستقلة</div>
          </div>

          {items.length > 0 && (
            <button onClick={() => setScreen("batch")} style={{ ...btnPrimary, width: "100%", marginBottom: 14 }}>
              📋 مراجعة العمليات المعلّقة ({pendingCount})
            </button>
          )}

          <div style={{ fontSize: 13, color: COLORS.textDim, margin: "18px 4px 8px", fontWeight: 700 }}>أو اختر نوع العملية يدويًا</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            {OP_TYPES.map((t) => (
              <button key={t.key} onClick={() => startManual(t.key)} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
          <button onClick={startCustom} style={{ ...btnGhost, width: "100%", borderColor: COLORS.gold, color: COLORS.gold }}>
            ⭐ عملية مخصصة (مرتجع، تعبئة لزبون، أو أي نوع تضيفه بنفسك)
          </button>
        </>
      )}

      {screen === "custom" && (
        <div style={{ background: COLORS.panel, borderRadius: 16, padding: 18, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.gold, marginBottom: 16 }}>⭐ عملية مخصصة</div>

          {customDone ? (
            <div style={{ textAlign: "center", padding: 20 }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>✅</div>
              <div style={{ color: COLORS.text, marginBottom: 18 }}>{customDone}</div>
              <button onClick={() => setScreen("home")} style={{ ...btnPrimary, width: "100%" }}>
                رجوع
              </button>
            </div>
          ) : (
            <>
              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>نوع العملية</div>
                <select
                  value={custom.type_name}
                  onChange={(e) => setCustom({ ...custom, type_name: e.target.value })}
                  style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.panelLight, color: COLORS.text, fontSize: 15 }}
                >
                  {opTypes.length === 0 && <option value="">أضف نوعًا من الإعدادات أولًا</option>}
                  {opTypes.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>الطرف</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setCustom({ ...custom, party_type: "customer" })}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${custom.party_type === "customer" ? COLORS.gold : COLORS.border}`, background: custom.party_type === "customer" ? "rgba(212,175,55,0.15)" : COLORS.panelLight, color: COLORS.text, cursor: "pointer" }}
                  >
                    عميل
                  </button>
                  <button
                    onClick={() => setCustom({ ...custom, party_type: "supplier" })}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${custom.party_type === "supplier" ? COLORS.gold : COLORS.border}`, background: custom.party_type === "supplier" ? "rgba(212,175,55,0.15)" : COLORS.panelLight, color: COLORS.text, cursor: "pointer" }}
                  >
                    مورد
                  </button>
                </div>
              </label>

              <Field label="اسم الطرف" value={custom.party_name} onChange={(v) => setCustom({ ...custom, party_name: v })} />
              <Field label="التاريخ" type="date" value={custom.date} onChange={(v) => setCustom({ ...custom, date: v })} />

              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>التأثير على الرصيد</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setCustom({ ...custom, effect: 1 })}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${custom.effect === 1 ? "#3EBD8C" : COLORS.border}`, background: custom.effect === 1 ? "rgba(62,189,140,0.15)" : COLORS.panelLight, color: COLORS.text, cursor: "pointer", fontWeight: 700 }}
                  >
                    + إضافة
                  </button>
                  <button
                    onClick={() => setCustom({ ...custom, effect: -1 })}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${custom.effect === -1 ? COLORS.red : COLORS.border}`, background: custom.effect === -1 ? "rgba(224,92,92,0.15)" : COLORS.panelLight, color: COLORS.text, cursor: "pointer", fontWeight: 700 }}
                  >
                    - خصم
                  </button>
                </div>
              </label>

              <Field label="المبلغ" type="number" value={custom.amount} onChange={(v) => setCustom({ ...custom, amount: v })} />
              <Field label="الوصف / الملاحظات" value={custom.description} onChange={(v) => setCustom({ ...custom, description: v })} />
              <Field label="رقم مرجعي (اختياري)" value={custom.reference_number} onChange={(v) => setCustom({ ...custom, reference_number: v })} />

              {customError && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>⚠️ {customError}</div>}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveCustom} disabled={customSaving} style={{ ...btnPrimary, flex: 1, opacity: customSaving ? 0.6 : 1 }}>
                  {customSaving ? "⏳ جاري الحفظ…" : "✅ حفظ"}
                </button>
                <button onClick={() => setScreen("home")} disabled={customSaving} style={{ ...btnGhost, flex: 1 }}>
                  ❌ إلغاء
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {screen === "batch" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.gold }}>📋 مراجعة العمليات ({items.length})</div>
            <button onClick={() => setScreen("home")} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>
              + إضافة المزيد
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{ color: COLORS.textDim, textAlign: "center", padding: 30 }}>لا توجد عمليات معلّقة.</div>
          ) : (
            items.map((item) => {
              const d = item.draft;
              const gross = num(d.quantity) !== null && num(d.unit_price) !== null ? num(d.quantity) * num(d.unit_price) : num(d.amount);
              const fees = num(d.fees) || 0;
              const net = gross !== null ? gross + fees : null;
              const isSaved = item.status === "saved";
              return (
                <div
                  key={item.id}
                  style={{
                    background: COLORS.panel,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 14,
                    border: `1.5px solid ${isSaved ? "#3EBD8C" : item.errorMsg ? COLORS.red : COLORS.border}`,
                    opacity: isSaved ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <select
                      value={d.type}
                      onChange={(e) => updateItemType(item.id, e.target.value)}
                      disabled={isSaved}
                      style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${COLORS.border}`, background: COLORS.panelLight, color: COLORS.gold, fontWeight: 700, fontSize: 13 }}
                    >
                      {OP_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.emoji} {t.label}
                        </option>
                      ))}
                    </select>
                    {!isSaved && (
                      <button onClick={() => removeItem(item.id)} style={{ background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                        🗑️ حذف
                      </button>
                    )}
                    {isSaved && <span style={{ color: "#3EBD8C", fontSize: 13, fontWeight: 700 }}>✅ تم الحفظ</span>}
                  </div>

                  {item.file && <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 10 }}>📎 {item.file.name}</div>}

                  {!isSaved && (
                    <>
                      {d.type !== "مصروف" && (
                        <Field
                          label={d.type === "شراء" || d.type === "دفعة_لمورد" ? "المورد" : "العميل"}
                          value={d.party_name}
                          onChange={(v) => updateItemDraft(item.id, "party_name", v)}
                        />
                      )}
                      <Field label="التاريخ" type="date" value={d.date} onChange={(v) => updateItemDraft(item.id, "date", v)} />

                      {(d.type === "بيع" || d.type === "شراء") && (
                        <>
                          <Field label="الصنف" value={d.product_name} onChange={(v) => updateItemDraft(item.id, "product_name", v)} />
                          {d.type === "بيع" && <Field label="الموقع" value={d.location_name} onChange={(v) => updateItemDraft(item.id, "location_name", v)} />}
                          <Field label="الكمية (لتر)" type="number" value={d.quantity} onChange={(v) => updateItemDraft(item.id, "quantity", v)} />
                          <Field label="السعر الفردي" type="number" value={d.unit_price} onChange={(v) => updateItemDraft(item.id, "unit_price", v)} />
                        </>
                      )}

                      <Field label="المبلغ" type="number" value={d.amount} onChange={(v) => updateItemDraft(item.id, "amount", v)} />
                      {d.type === "بيع" && <Field label="الرسوم" type="number" value={d.fees} onChange={(v) => updateItemDraft(item.id, "fees", v)} />}
                      <Field label="رقم الفاتورة" value={d.invoice_number} onChange={(v) => updateItemDraft(item.id, "invoice_number", v)} />
                      <Field label="ملاحظات" value={d.notes} onChange={(v) => updateItemDraft(item.id, "notes", v)} />

                      {gross !== null && (
                        <div style={{ background: COLORS.panelLight, borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13, color: COLORS.text }}>
                          الإجمالي: <b>{money(gross)}</b>
                          {d.type === "بيع" && (
                            <>
                              {" "}
                              · الصافي: <b style={{ color: COLORS.gold }}>{money(net)}</b>
                            </>
                          )}
                        </div>
                      )}

                      {d.missing?.length > 0 && (
                        <div style={{ background: "#3a331a", color: "#e0c88a", padding: 8, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>⚠️ ناقص: {d.missing.join("، ")}</div>
                      )}

                      {item.errorMsg && <div style={{ color: COLORS.red, fontSize: 12, marginBottom: 10 }}>⚠️ {item.errorMsg}</div>}

                      <button
                        onClick={() => approveItem(item.id)}
                        disabled={item.status === "saving"}
                        style={{ ...btnPrimary, width: "100%", opacity: item.status === "saving" ? 0.6 : 1 }}
                      >
                        {item.status === "saving" ? "⏳ جاري الحفظ…" : "✅ اعتماد وحفظ"}
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}

          {batchLoading && <div style={{ color: COLORS.gold, textAlign: "center", padding: 10 }}>{batchProgress}</div>}
        </div>
      )}
    </div>
  );
}
