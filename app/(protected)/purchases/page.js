"use client";
import React, { useEffect, useState } from "react";
import { buildGlobalLedger, updatePurchase, deletePurchase, deleteCustomOperation, deletePayment } from "../../../lib/dataHelpers";
import { COLORS, money, fmtDateTime, num } from "../../../lib/theme";

export default function PurchasesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const data = await buildGlobalLedger("supplier");
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(r) {
    if (r.op_type_name !== "شراء") {
      alert("التعديل المباشر متاح حاليًا لعمليات الشراء فقط.\nللعمليات الأخرى (الدفعات والعمليات المخصصة)، احذفها وأعد تسجيلها من المحادثة.");
      return;
    }
    setEditing({
      _id: r._id,
      date: r.date,
      quantity: r.qty ?? "",
      unit_price: r.unit_price ?? "",
      amount: r.display_total ?? "",
      paid: r.display_paid ?? "",
      invoice_number: r.invoice_number ?? "",
      notes: r.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const qty = num(editing.quantity);
      const price = num(editing.unit_price);
      const amount = num(editing.amount) ?? (qty && price ? qty * price : null);
      if (amount === null) throw new Error("المبلغ أو (الكمية والسعر) مطلوب");
      const paid = num(editing.paid) || 0;
      await updatePurchase(editing._id, {
        date: editing.date,
        quantity: qty,
        unit_price: price,
        amount,
        paid,
        running_balance: amount - paid,
        invoice_number: editing.invoice_number || null,
        notes: editing.notes || null,
      });
      setEditing(null);
      load();
    } catch (e) {
      alert("تعذر الحفظ: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(r) {
    if (r.op_number === "OPENING") {
      alert("الرصيد الافتتاحي يُحذف من صفحة الإعدادات.");
      return;
    }
    if (!confirm("تأكيد حذف هذه العملية نهائيًا؟")) return;
    try {
      if (r.op_type_name === "شراء") await deletePurchase(r._id);
      else if (r.op_type_name === "دفعة لمورد") await deletePayment(r._id);
      else await deleteCustomOperation(r._id);
      load();
    } catch (e) {
      alert("تعذر الحذف: " + e.message);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>المشتريات — كشف المعاينة</h1>

      {editing && (
        <div style={{ background: COLORS.panel, border: `1.5px solid ${COLORS.gold}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: COLORS.gold, marginBottom: 12 }}>تعديل عملية شراء</div>
          <EditField label="التاريخ" type="date" value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} />
          <EditField label="الكمية" type="number" value={editing.quantity} onChange={(v) => setEditing({ ...editing, quantity: v })} />
          <EditField label="السعر الفردي" type="number" value={editing.unit_price} onChange={(v) => setEditing({ ...editing, unit_price: v })} />
          <EditField label="المبلغ الإجمالي" type="number" value={editing.amount} onChange={(v) => setEditing({ ...editing, amount: v })} />
          <EditField label="المدفوع" type="number" value={editing.paid} onChange={(v) => setEditing({ ...editing, paid: v })} />
          <EditField label="رقم الفاتورة" value={editing.invoice_number} onChange={(v) => setEditing({ ...editing, invoice_number: v })} />
          <EditField label="ملاحظات" value={editing.notes} onChange={(v) => setEditing({ ...editing, notes: v })} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: COLORS.gold, color: COLORS.bg, border: "none", borderRadius: 8, padding: 10, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "جاري الحفظ..." : "حفظ التعديل"}
            </button>
            <button onClick={() => setEditing(null)} disabled={saving} style={{ flex: 1, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 8, padding: 10, cursor: "pointer" }}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل...</div>
      ) : rows.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>لا توجد عمليات بعد.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1000 }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {["#", "رقم العملية", "التاريخ", "المورد", "العملية", "الصنف", "الكمية", "الموقع", "السعر", "الإجمالي", "المدفوع", "المتبقي", "الفاتورة", "ملاحظات", ""].map((h, i) => (
                  <th key={i} style={{ padding: 8, color: COLORS.gold, border: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const dt = fmtDateTime(r.created_at || r.date);
                return (
                  <tr key={r.op_number + i} style={{ background: i % 2 ? COLORS.panelLight : "transparent" }}>
                    <td style={cellStyle}>{i + 1}</td>
                    <td style={cellStyle}>{r.op_number}</td>
                    <td style={cellStyle}>{fmtDateTime(r.date).date}<br /><small style={{ color: COLORS.textDim }}>{dt.time}</small></td>
                    <td style={cellStyle}>{r.party_name}</td>
                    <td style={cellStyle}>{r.op_type_name}</td>
                    <td style={cellStyle}>{r.item_name || "—"}</td>
                    <td style={cellStyle}>{r.qty ? Number(r.qty).toLocaleString() : "—"}</td>
                    <td style={cellStyle}>{r.location_name || "—"}</td>
                    <td style={cellStyle}>{r.unit_price || "—"}</td>
                    <td style={cellStyle}>{money(r.display_total)}</td>
                    <td style={cellStyle}>{money(r.display_paid)}</td>
                    <td style={cellStyle}>{money(r.display_due)}</td>
                    <td style={cellStyle}>{r.invoice_number || "—"}</td>
                    <td style={{ ...cellStyle, fontSize: 10, color: COLORS.textDim, maxWidth: 110 }}>{r.notes || "—"}</td>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                      {r.op_number !== "OPENING" && (
                        <>
                          <button onClick={() => startEdit(r)} style={miniBtn}>تعديل</button>
                          <button onClick={() => removeRow(r)} style={miniBtnDanger}>حذف</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: 9, borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panelLight, color: COLORS.text, fontSize: 13, boxSizing: "border-box" }}
      />
    </label>
  );
}

const cellStyle = { padding: 7, textAlign: "center", border: `1px solid ${COLORS.border}`, color: COLORS.text };
const miniBtn = { background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.text, borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer", marginLeft: 4 };
const miniBtnDanger = { background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: "pointer" };
