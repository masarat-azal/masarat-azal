"use client";
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, num } from "../../../../lib/theme";
import { fetchLists, ensureParty, ensureProduct, findByName } from "../../../../lib/dataHelpers";

const OP_TYPES = [
  { key: "بيع", label: "بيع", emoji: "🟢" },
  { key: "شراء", label: "شراء", emoji: "🟤" },
  { key: "دفعة_من_عميل", label: "دفعة من عميل", emoji: "🔵" },
  { key: "دفعة_لمورد", label: "دفعة لمورد", emoji: "🔵" },
  { key: "مصروف", label: "مصروف", emoji: "🧾" },
];

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: 10,
          border: `1.5px solid ${COLORS.silver}`,
          fontSize: 15,
          boxSizing: "border-box",
          outline: "none",
        }}
      />
    </label>
  );
}

export default function NewOperationPage() {
  const [screen, setScreen] = useState("home");
  const [lists, setLists] = useState({ customers: [], suppliers: [], products: [], locations: [] });
  const [loadingLists, setLoadingLists] = useState(true);
  const [listError, setListError] = useState("");

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedSummary, setSavedSummary] = useState(null);

  const load = useCallback(async () => {
    setLoadingLists(true);
    setListError("");
    try {
      setLists(await fetchLists());
    } catch (e) {
      setListError(e.message);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAI() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch("/api/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: aiText,
          customers: lists.customers.map((c) => c.name),
          suppliers: lists.suppliers.map((s) => s.name),
          products: lists.products.map((p) => p.name),
          locations: lists.locations.map((l) => l.name),
        }),
      });
      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "خطأ غير معروف");
      if (parsed.type === "غير_مفهوم") {
        setAiError("ما فهمت المطلوب بوضوح كافٍ. جرّب صياغة أوضح، أو استخدم الإدخال اليدوي.");
        return;
      }
      setDraft({ ...parsed, missing: parsed.missing || [] });
      setScreen("review");
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }

  function startManual(type) {
    setDraft({
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
    });
    setScreen("review");
  }

  function updateDraft(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  const gross =
    draft && num(draft.quantity) !== null && num(draft.unit_price) !== null
      ? num(draft.quantity) * num(draft.unit_price)
      : num(draft?.amount);
  const fees = num(draft?.fees) || 0;
  const net = gross !== null ? gross + fees : null;

  async function approve() {
    if (!draft) return;
    setSaving(true);
    setSaveError("");
    try {
      const opNumber = `${draft.type === "بيع" ? "S" : draft.type === "شراء" ? "P" : "T"}-${Date.now()}`;

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
        setSavedSummary(`تم تسجيل بيع لـ${draft.party_name}: ${qty.toLocaleString()} لتر × ${price} = ${money(g)}`);
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
        setSavedSummary(`تم تسجيل شراء من ${draft.party_name} بمبلغ ${money(amount)}`);
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
        setSavedSummary(`تم تسجيل ${isCustomer ? "تحصيل من" : "سداد لـ"} ${draft.party_name}: ${money(amount)}`);
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
        setSavedSummary(`تم تسجيل مصروف بمبلغ ${money(amount)}`);
      }
      setScreen("done");
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const btnPrimary = {
    background: COLORS.green,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };
  const btnGhost = {
    background: "#fff",
    color: COLORS.green,
    border: `1.5px solid ${COLORS.silver}`,
    borderRadius: 12,
    padding: "13px 20px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.green, marginBottom: 16 }}>عملية جديدة</h1>

      {listError && (
        <div style={{ background: "#FDECEA", color: COLORS.red, padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
          ⚠️ {listError}
        </div>
      )}

      {screen === "home" && (
        <>
          <div style={{ background: "#fff", borderRadius: 16, padding: 18, marginBottom: 14, border: `1px solid ${COLORS.silver}` }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: COLORS.green }}>✨ إدخال بالذكاء الاصطناعي</div>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="مثال: اشتريت من محطة النور 20000 لتر ديزل بسعر 1.82"
              rows={3}
              style={{
                width: "100%",
                borderRadius: 10,
                border: `1.5px solid ${COLORS.silver}`,
                padding: 12,
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
                outline: "none",
              }}
            />
            {aiError && <div style={{ color: COLORS.red, fontSize: 13, marginTop: 8 }}>⚠️ {aiError}</div>}
            <button
              onClick={runAI}
              disabled={aiLoading || !aiText.trim() || loadingLists}
              style={{ ...btnPrimary, width: "100%", marginTop: 10, opacity: aiLoading || loadingLists ? 0.6 : 1 }}
            >
              {aiLoading ? "⏳ جاري التحليل…" : loadingLists ? "⏳ تحميل البيانات…" : "تحليل واعتماد"}
            </button>
          </div>

          <div style={{ fontSize: 13, color: COLORS.grey, margin: "18px 4px 8px", fontWeight: 700 }}>أو اختر نوع العملية يدويًا</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {OP_TYPES.map((t) => (
              <button key={t.key} onClick={() => startManual(t.key)} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span>{t.emoji}</span> {t.label}
              </button>
            ))}
          </div>
        </>
      )}

      {screen === "review" && draft && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 18, border: `1px solid ${COLORS.silver}` }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.green, marginBottom: 4 }}>📋 مراجعة قبل الحفظ</div>
          <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 16 }}>
            نوع العملية: <b style={{ color: COLORS.text }}>{OP_TYPES.find((t) => t.key === draft.type)?.label || draft.type}</b>
          </div>

          {draft.type !== "مصروف" && (
            <Field label={draft.type === "شراء" || draft.type === "دفعة_لمورد" ? "المورد" : "العميل"} value={draft.party_name} onChange={(v) => updateDraft("party_name", v)} />
          )}
          <Field label="التاريخ" type="date" value={draft.date} onChange={(v) => updateDraft("date", v)} />

          {(draft.type === "بيع" || draft.type === "شراء") && (
            <>
              <Field label="الصنف" value={draft.product_name} onChange={(v) => updateDraft("product_name", v)} />
              {draft.type === "بيع" && <Field label="الموقع" value={draft.location_name} onChange={(v) => updateDraft("location_name", v)} />}
              <Field label="الكمية (لتر)" type="number" value={draft.quantity} onChange={(v) => updateDraft("quantity", v)} />
              <Field label="السعر الفردي" type="number" value={draft.unit_price} onChange={(v) => updateDraft("unit_price", v)} />
            </>
          )}

          <Field label="المبلغ (اختياري إن وُجدت كمية وسعر)" type="number" value={draft.amount} onChange={(v) => updateDraft("amount", v)} />
          {draft.type === "بيع" && <Field label="الرسوم" type="number" value={draft.fees} onChange={(v) => updateDraft("fees", v)} />}
          <Field label="رقم الفاتورة" value={draft.invoice_number} onChange={(v) => updateDraft("invoice_number", v)} />
          <Field label="ملاحظات" value={draft.notes} onChange={(v) => updateDraft("notes", v)} />

          {gross !== null && (
            <div style={{ background: COLORS.band, borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 14, fontSize: 14 }}>
              الإجمالي: <b>{money(gross)}</b>
              {draft.type === "بيع" && (
                <>
                  {" "}
                  · صافي الإجمالي: <b style={{ color: COLORS.gold }}>{money(net)}</b>
                </>
              )}
            </div>
          )}

          {draft.missing?.length > 0 && (
            <div style={{ background: "#FFF6DC", color: "#8a6d1a", padding: 10, borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
              ⚠️ ناقص: {draft.missing.join("، ")}
            </div>
          )}

          {saveError && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 12 }}>⚠️ {saveError}</div>}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={approve} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.6 : 1 }}>
              {saving ? "⏳ جاري الحفظ…" : "✅ اعتماد وحفظ"}
            </button>
            <button
              onClick={() => {
                setScreen("home");
                setDraft(null);
                setAiText("");
                setAiError("");
                setSaveError("");
              }}
              disabled={saving}
              style={{ ...btnGhost, flex: 1 }}
            >
              ❌ إلغاء
            </button>
          </div>
        </div>
      )}

      {screen === "done" && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 24, textAlign: "center", border: `1px solid ${COLORS.silver}` }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.green, marginBottom: 8 }}>تم الحفظ في قاعدة البيانات</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>{savedSummary}</div>
          <button
            onClick={() => {
              setScreen("home");
              setDraft(null);
              setAiText("");
              setSavedSummary(null);
              load();
            }}
            style={{ ...btnPrimary, width: "100%" }}
          >
            + عملية جديدة
          </button>
        </div>
      )}
    </div>
  );
}
