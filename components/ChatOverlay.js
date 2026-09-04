"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { COLORS, money, num, fmtDateTime } from "../lib/theme";
import {
  fetchLists,
  fetchOperationTypes,
  ensureParty,
  findByName,
  saveOperationByType,
  uploadDocument,
  lookupPrice,
} from "../lib/dataHelpers";

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function emptyFields() {
  return {
    party_name: "",
    party_type: "customer",
    date: new Date().toISOString().slice(0, 10),
    location_name: "",
    product_name: "ديزل",
    quantity: null,
    unit_price: null,
    amount: null,
    fees: null,
    paid: null,
    invoice_number: "",
    notes: "",
    effect: 1,
    missing: [],
  };
}

async function insertMsg(role, kind, payload) {
  const { data, error } = await supabase.from("chat_messages").insert({ role, kind, payload }).select().single();
  if (error) throw error;
  return data;
}
async function updateMsg(id, payload) {
  await supabase.from("chat_messages").update({ payload }).eq("id", id);
}

export default function ChatOverlay({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lists, setLists] = useState({ customers: [], suppliers: [], products: [], locations: [] });
  const [opTypes, setOpTypes] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  const load = useCallback(async () => {
    const [l, ops, { data: hist }] = await Promise.all([
      fetchLists(),
      fetchOperationTypes(),
      supabase.from("chat_messages").select("*").order("created_at", { ascending: true }),
    ]);
    setLists(l);
    setOpTypes(ops);
    setMessages(hist || []);
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  function typeRowForAiType(aiType) {
    const map = {
      بيع: "sale",
      شراء: "purchase",
      دفعة_من_عميل: "customer_payment",
      دفعة_لمورد: "supplier_payment",
      مصروف: "expense",
    };
    const key = map[aiType];
    return opTypes.find((t) => t.system_key === key) || null;
  }

  async function sendText() {
    if (!text.trim() || busy) return;
    const userText = text.trim();
    setText("");
    const userMsg = await insertMsg("user", "text", { text: userText });
    setMessages((m) => [...m, userMsg]);

    setBusy(true);
    setBusyLabel("⏳ جاري التحليل…");
    try {
      const parsed = await callAI({ text: userText });
      const typeRow = typeRowForAiType(parsed.type);
      const cardPayload = {
        typeRowId: typeRow?.id || null,
        fields: { ...emptyFields(), ...parsed, missing: parsed.missing || [] },
        status: "review",
        errorMsg: !typeRow ? "لم يفهم البوت نوع العملية بوضوح — اختر النوع يدويًا من القائمة." : "",
        fileName: null,
      };
      const botMsg = await insertMsg("bot", "card", cardPayload);
      setMessages((m) => [...m, botMsg]);
    } catch (e) {
      const errMsg = await insertMsg("bot", "error", { text: e.message });
      setMessages((m) => [...m, errMsg]);
    } finally {
      setBusy(false);
      setBusyLabel("");
    }
  }

  async function sendFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBusyLabel(`⏳ تحليل الملف ${i + 1} من ${files.length}…`);
      const userMsg = await insertMsg("user", "file", { fileName: file.name });
      setMessages((m) => [...m, userMsg]);

      try {
        const base64 = await fileToBase64(file);
        const parsed = await callAI({ image: base64, mimeType: file.type });
        const typeRow = typeRowForAiType(parsed.type);
        const cardPayload = {
          typeRowId: typeRow?.id || null,
          fields: { ...emptyFields(), ...parsed, missing: parsed.missing || [] },
          status: "review",
          errorMsg: !typeRow
            ? `تعذّر فهم نوع العملية في الملف "${file.name}" بوضوح — اختر النوع والحقول يدويًا.`
            : "",
          fileName: file.name,
          pendingFileKey: file.name + "|" + Date.now(),
        };
        const botMsg = await insertMsg("bot", "card", cardPayload);
        botMsg.__file = file; // نحتفظ بالملف الفعلي في الذاكرة لرفعه لاحقًا عند الاعتماد فقط
        setMessages((m) => [...m, botMsg]);
      } catch (e) {
        const errMsg = await insertMsg("bot", "error", { text: `تعذّر تحليل الملف "${file.name}": ${e.message}` });
        setMessages((m) => [...m, errMsg]);
        const cardPayload = {
          typeRowId: null,
          fields: emptyFields(),
          status: "review",
          errorMsg: `فشل التحليل التلقائي للملف "${file.name}" — عبّئ الحقول يدويًا أو احذف هذه البطاقة.`,
          fileName: file.name,
        };
        const botMsg = await insertMsg("bot", "card", cardPayload);
        botMsg.__file = file;
        setMessages((m) => [...m, botMsg]);
      }
    }
    setBusy(false);
    setBusyLabel("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function updateCardField(msgId, field, value) {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, payload: { ...m.payload, fields: { ...m.payload.fields, [field]: value } } } : m))
    );

    // عند اختيار الموقع لعملية بيع، نحاول تعبئة السعر تلقائيًا من الأسعار المحفوظة لهذا العميل عند هذا الموقع
    if (field === "location_name") {
      const m = messages.find((x) => x.id === msgId);
      if (m && !m.payload.fields.unit_price) {
        const customer = findByName(lists.customers, m.payload.fields.party_name);
        const location = findByName(lists.locations, value);
        if (customer && location) {
          try {
            const price = await lookupPrice("customer", customer.id, location.id);
            if (price !== null) {
              setMessages((prev) =>
                prev.map((x) => (x.id === msgId ? { ...x, payload: { ...x.payload, fields: { ...x.payload.fields, unit_price: price } } } : x))
              );
            }
          } catch (e) {}
        }
      }
    }
  }
  async function updateCardType(msgId, typeRowId) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, payload: { ...m.payload, typeRowId } } : m)));
  }

  async function persistCard(msgId) {
    const m = messages.find((x) => x.id === msgId);
    if (m) await updateMsg(msgId, m.payload);
  }

  async function approveCard(msgId) {
    const m = messages.find((x) => x.id === msgId);
    if (!m) return;
    const typeRow = opTypes.find((t) => t.id === m.payload.typeRowId);
    if (!typeRow) {
      alert("اختر نوع العملية أولًا");
      return;
    }
    setMessages((prev) => prev.map((x) => (x.id === msgId ? { ...x, payload: { ...x.payload, status: "saving" } } : x)));
    try {
      const opNumber = await saveOperationByType(typeRow, m.payload.fields, lists);
      if (m.__file) {
        await uploadDocument(m.__file, opNumber, m.__file.type);
      }
      const newPayload = { ...m.payload, status: "saved", opNumber };
      await updateMsg(msgId, newPayload);
      setMessages((prev) => prev.map((x) => (x.id === msgId ? { ...x, payload: newPayload } : x)));
    } catch (e) {
      const newPayload = { ...m.payload, status: "review", errorMsg: e.message };
      setMessages((prev) => prev.map((x) => (x.id === msgId ? { ...x, payload: newPayload } : x)));
    }
  }

  async function cancelCard(msgId) {
    await supabase.from("chat_messages").delete().eq("id", msgId);
    setMessages((prev) => prev.filter((x) => x.id !== msgId));
  }

  async function deleteConversation() {
    if (!confirm("حذف كل رسائل هذه المحادثة؟ (لن يؤثر هذا على أي عملية محفوظة فعليًا في النظام)")) return;
    await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setMessages([]);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: COLORS.bg, zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div style={{ background: COLORS.gradPanel, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${COLORS.border}` }}>
        <div>
          <div style={{ fontWeight: 800, color: COLORS.gold, fontSize: 15 }}>💬 محادثة مسارات أزل</div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>أرسل نصًا أو صورة/ملف فاتورة</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={deleteConversation} style={{ background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}>
            🗑️
          </button>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
            ✕ إغلاق
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {loadingHistory ? (
          <div style={{ color: COLORS.textDim, textAlign: "center" }}>جاري التحميل…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: COLORS.textDim, textAlign: "center", marginTop: 40 }}>لا رسائل بعد — ابدأ بإرسال نص أو صورة.</div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} msg={m} opTypes={opTypes} lists={lists} onUpdateField={updateCardField} onUpdateType={updateCardType} onBlurPersist={persistCard} onApprove={approveCard} onCancel={cancelCard} />)
        )}
        {busy && <div style={{ textAlign: "center", color: COLORS.gold, fontSize: 13, marginTop: 8 }}>{busyLabel}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${COLORS.border}`, background: COLORS.panel }}>
        <input ref={fileInputRef} type="file" accept="image/*,.pdf" multiple onChange={(e) => sendFiles(e.target.files)} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={busy} style={{ background: COLORS.panelLight, border: `1px solid ${COLORS.border}`, color: COLORS.gold, borderRadius: "50%", width: 40, height: 40, fontSize: 17, cursor: "pointer" }}>
          📎
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder="اكتب رسالة..."
          style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${COLORS.border}`, background: COLORS.panelLight, color: COLORS.text }}
        />
        <button onClick={sendText} disabled={busy || !text.trim()} style={{ background: COLORS.gradGold, border: "none", color: COLORS.bg, borderRadius: "50%", width: 40, height: 40, fontSize: 16, cursor: "pointer", opacity: busy ? 0.6 : 1 }}>
          ➤
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, opTypes, lists, onUpdateField, onUpdateType, onBlurPersist, onApprove, onCancel }) {
  const isUser = msg.role === "user";
  const { date, time } = fmtDateTime(msg.created_at);

  if (msg.kind === "text") {
    return (
      <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
        <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 14, background: isUser ? COLORS.chatUserBubble : COLORS.chatBotBubble, color: COLORS.text, fontSize: 14 }}>
          {msg.payload.text}
          <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 4, textAlign: "left" }}>{time}</div>
        </div>
      </div>
    );
  }

  if (msg.kind === "file") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: 14, background: COLORS.chatUserBubble, color: COLORS.text, fontSize: 14 }}>
          📎 {msg.payload.fileName}
          <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 4, textAlign: "left" }}>{time}</div>
        </div>
      </div>
    );
  }

  if (msg.kind === "error") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
        <div style={{ maxWidth: "85%", padding: "9px 13px", borderRadius: 14, background: "#3a1f1f", color: COLORS.red, fontSize: 13 }}>⚠️ {msg.payload.text}</div>
      </div>
    );
  }

  if (msg.kind === "card") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 14 }}>
        <OperationCard msg={msg} opTypes={opTypes} lists={lists} onUpdateField={onUpdateField} onUpdateType={onUpdateType} onBlurPersist={onBlurPersist} onApprove={onApprove} onCancel={onCancel} />
      </div>
    );
  }
  return null;
}

const PICKER_FIELDS = {
  party_name: null, // يُبنى ديناميكيًا حسب نوع الطرف
};

function OperationCard({ msg, opTypes, lists, onUpdateField, onUpdateType, onBlurPersist, onApprove, onCancel }) {
  const [picker, setPicker] = useState(null); // { field, options }
  const { fields, status, errorMsg, fileName } = msg.payload;
  const typeRow = opTypes.find((t) => t.id === msg.payload.typeRowId);
  const isSaved = status === "saved";
  const isSaving = status === "saving";

  const gross = num(fields.quantity) !== null && num(fields.unit_price) !== null ? num(fields.quantity) * num(fields.unit_price) : num(fields.amount);
  const paid = num(fields.paid) || 0;
  const due = gross !== null ? gross - paid : null;

  function field(label, value, onClick, empty) {
    return (
      <div
        onClick={!isSaved ? onClick : undefined}
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "7px 0",
          borderBottom: `1px dashed ${COLORS.border}`,
          fontSize: 13,
          cursor: onClick && !isSaved ? "pointer" : "default",
        }}
      >
        <span style={{ color: COLORS.textDim, fontSize: 11 }}>{label}</span>
        <span style={{ color: empty ? COLORS.red : COLORS.text, fontWeight: 600 }}>{value}</span>
      </div>
    );
  }

  function editableField(label, value, onChange, type = "text") {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px dashed ${COLORS.border}`, fontSize: 13 }}>
        <span style={{ color: COLORS.textDim, fontSize: 11 }}>{label}</span>
        <input
          disabled={isSaved}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onBlurPersist(msg.id)}
          style={{ background: "transparent", border: "none", color: COLORS.text, textAlign: "left", width: 110, fontWeight: 600, outline: "none" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: "88%",
        minWidth: "78%",
        background: COLORS.chatBotBubble,
        borderRadius: 14,
        padding: 14,
        border: `1.5px solid ${isSaved ? COLORS.green : errorMsg ? COLORS.red : COLORS.border}`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div
          onClick={() => !isSaved && setPicker({ field: "type", options: opTypes.map((t) => ({ id: t.id, label: t.name })) })}
          style={{ fontWeight: 800, color: COLORS.gold, fontSize: 13, cursor: isSaved ? "default" : "pointer" }}
        >
          {isSaved ? "✅ تم اعتماد العملية" : typeRow ? `📋 ${typeRow.name}` : "📋 اختر نوع العملية ⚠️"}
        </div>
        {fileName && <div style={{ fontSize: 10, color: COLORS.textDim }}>📎 {fileName}</div>}
      </div>

      {errorMsg && !isSaved && <div style={{ background: "#3a331a", color: "#e0c88a", padding: 8, borderRadius: 8, fontSize: 11, marginBottom: 8 }}>⚠️ {errorMsg}</div>}

      {isSaved ? (
        <div style={{ fontSize: 12, color: COLORS.textDim }}>
          رقم العملية: <b style={{ color: COLORS.text }}>{msg.payload.opNumber}</b>
        </div>
      ) : (
        <>
          {field("العميل / المورد", fields.party_name || "اكتب الاسم ⚠️", () => {
            const name = prompt("اسم العميل أو المورد:", fields.party_name || "");
            if (name !== null) {
              onUpdateField(msg.id, "party_name", name);
              onBlurPersist(msg.id);
            }
          }, !fields.party_name)}

          {editableField("التاريخ", fields.date, (v) => onUpdateField(msg.id, "date", v), "date")}

          {typeRow?.system_key === "sale" || typeRow?.system_key === "purchase" || !typeRow ? (
            <>
              {field("الصنف", fields.product_name || "اختر ⚠️", () => setPicker({ field: "product_name", options: lists.products.map((p) => ({ id: p.id, label: p.name })) }))}
              {typeRow?.system_key === "sale" && field("الموقع", fields.location_name || "اختر ⚠️", () => setPicker({ field: "location_name", options: lists.locations.map((l) => ({ id: l.id, label: l.name })) }), !fields.location_name)}
              {editableField("الكمية (لتر)", fields.quantity, (v) => onUpdateField(msg.id, "quantity", v), "number")}
              {editableField("السعر الفردي", fields.unit_price, (v) => onUpdateField(msg.id, "unit_price", v), "number")}
            </>
          ) : null}

          {editableField("المبلغ", fields.amount, (v) => onUpdateField(msg.id, "amount", v), "number")}
          {editableField("المدفوع", fields.paid, (v) => onUpdateField(msg.id, "paid", v), "number")}
          {editableField("رقم الفاتورة", fields.invoice_number, (v) => onUpdateField(msg.id, "invoice_number", v))}
          {editableField("ملاحظات", fields.notes, (v) => onUpdateField(msg.id, "notes", v))}

          {gross !== null && (
            <div style={{ background: COLORS.panelLight, borderRadius: 8, padding: 8, margin: "8px 0", fontSize: 12 }}>
              الإجمالي: <b>{money(gross)}</b> · المتبقي: <b style={{ color: COLORS.gold }}>{money(due)}</b>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => onApprove(msg.id)} disabled={isSaving} style={{ flex: 1, background: COLORS.gradGold, color: COLORS.bg, border: "none", borderRadius: 8, padding: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {isSaving ? "⏳..." : "✅ اعتماد"}
            </button>
            <button onClick={() => onCancel(msg.id)} disabled={isSaving} style={{ flex: 1, background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 8, padding: 9, fontSize: 13, cursor: "pointer" }}>
              ❌ إلغاء
            </button>
          </div>
        </>
      )}

      {picker && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }} onClick={() => setPicker(null)}>
          <div style={{ background: COLORS.panel, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>اختر</div>
            {(picker.field === "type" ? picker.options : picker.options).map((o) => (
              <div
                key={o.id}
                onClick={() => {
                  if (picker.field === "type") onUpdateType(msg.id, o.id);
                  else onUpdateField(msg.id, picker.field, o.label);
                  onBlurPersist(msg.id);
                  setPicker(null);
                }}
                style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, cursor: "pointer" }}
              >
                {o.label}
              </div>
            ))}
            <div onClick={() => setPicker(null)} style={{ textAlign: "center", padding: 10, color: COLORS.red, cursor: "pointer" }}>
              إلغاء
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
