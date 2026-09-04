"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";
import { COLORS, money, fmtDateTime } from "../../../../lib/theme";
import { buildPartyLedger, balanceDirection, deleteSale, deleteCustomOperation, deletePayment, fetchDocumentsMap } from "../../../../lib/dataHelpers";
import { generateShapedStatement, generateQuickImage } from "../../../../lib/pdfGenerator";

const SHAPES = [
  { key: "matching", label: "كشف مطابقة" },
  { key: "due", label: "كشف الرصيد المستحق" },
  { key: "general1", label: "كشف عام 1" },
  { key: "lahwalayh", label: "كشف له وعليه" },
  { key: "general2", label: "كشف عام 2" },
  { key: "quick", label: "كشف سريع (صورة)" },
  { key: "textual", label: "كشف نصي" },
];

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [docsMap, setDocsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [textualMsg, setTextualMsg] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from("customers").select("*").eq("id", id).single();
    const l = await buildPartyLedger("customer", id);
    const docs = await fetchDocumentsMap(l.rows.map((r) => r.op_number).filter((n) => n && n !== "OPENING"));
    setCustomer(c);
    setLedger(l);
    setDocsMap(docs);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [id]);

  if (loading || !ledger) return <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>;
  if (!customer) return <div style={{ color: COLORS.red }}>العميل غير موجود.</div>;

  const dir = balanceDirection(false, ledger.balance);
  const periodText = ledger.rowsAsc.length
    ? `${new Date(ledger.rowsAsc[0].date).toLocaleDateString("en-GB")} — ${new Date(ledger.rowsAsc[ledger.rowsAsc.length - 1].date).toLocaleDateString("en-GB")}`
    : "—";

  async function deleteRow(row) {
    if (!confirm("تأكيد حذف هذه العملية نهائيًا؟")) return;
    if (row.op_number === "OPENING") {
      alert("لحذف الرصيد الافتتاحي، احذفه من صفحة الإعدادات مباشرة من قاعدة البيانات.");
      return;
    }
    if (row.op_type_name === "بيع") await deleteSale(row._id);
    else if (row.op_type_name === "دفعة من عميل") await deletePayment(row._id);
    else await deleteCustomOperation(row._id);
    load();
  }

  function filterByPeriod(rows) {
    if (!fromDate && !toDate) return rows;
    return rows.filter((r) => {
      const d = new Date(r.date);
      if (fromDate && d < new Date(fromDate)) return false;
      if (toDate && d > new Date(toDate)) return false;
      return true;
    });
  }

  async function exportShape(shapeKey) {
    setShowPicker(false);
    setExporting(true);
    try {
      const dueTxt = `${dir.text}: ${money(dir.amount)}`;
      const periodLabel = fromDate || toDate
        ? `${fromDate ? new Date(fromDate).toLocaleDateString("en-GB") : "البداية"} — ${toDate ? new Date(toDate).toLocaleDateString("en-GB") : "اليوم"}`
        : periodText;
      if (shapeKey === "textual") {
        setTextualMsg(`📌 ${customer.name}\nإجمالي الرصيد: ${money(Math.abs(ledger.balance))}\n${dir.icon} ${dueTxt}\nالفترة: ${periodLabel}`);
        setExporting(false);
        return;
      }
      if (shapeKey === "quick") {
        await generateQuickImage({
          partyName: customer.name,
          rows: filterByPeriod(ledger.rows).map((r) => ({ date: fmtDateTime(r.date).date, item: r.item_name || r.op_type_name, price: r.unit_price || "—", total: money(r.display_total), paid: money(r.display_paid), due: money(r.display_due) })),
          totalsRows: [
            { label: "إجمالي المستحق", value: money(ledger.totalDue) },
            { label: "إجمالي المدفوع", value: money(ledger.totalPaid) },
            { label: dueTxt, value: "", highlight: true },
          ],
        });
        setExporting(false);
        return;
      }

      const itemTotals = Object.entries(ledger.byItem).map(([item, v]) => ({ item, qty: `${v.qty.toLocaleString()} لتر`, amount: money(v.amount) }));
      const totalsRows = [
        { label: "إجمالي المستحق", value: money(ledger.totalDue) },
        { label: "إجمالي المدفوع", value: money(ledger.totalPaid) },
        { label: dueTxt, value: "", highlight: true },
      ];

      let columns, rows, titleAr, titleEn;
      if (shapeKey === "matching") {
        titleAr = "كشف مطابقة"; titleEn = "Matching Statement";
        columns = [
          { key: "num", ar: "#", en: "#" }, { key: "op", ar: "رقم العملية", en: "Op No." }, { key: "date", ar: "التاريخ", en: "Date" },
          { key: "party", ar: "العميل", en: "Customer" }, { key: "type", ar: "العملية", en: "Type" }, { key: "item", ar: "الصنف", en: "Item" },
          { key: "qty", ar: "الكمية", en: "Qty" }, { key: "loc", ar: "الموقع", en: "Location" }, { key: "price", ar: "السعر", en: "Price" },
          { key: "total", ar: "الإجمالي", en: "Total" }, { key: "paid", ar: "المدفوع", en: "Paid" }, { key: "due", ar: "المتبقي", en: "Due" },
          { key: "bal", ar: "الرصيد", en: "Balance" }, { key: "inv", ar: "الفاتورة", en: "Invoice" }, { key: "__doc__", ar: "المستندات", en: "Docs" }, { key: "notes", ar: "ملاحظات", en: "Notes" },
        ];
        rows = filterByPeriod(ledger.rows).map((r, i) => ({
          num: i + 1, op: r.op_number, date: fmtDateTime(r.date).date, party: customer.name, type: r.op_type_name, item: r.item_name || "—",
          qty: r.qty ? Number(r.qty).toLocaleString() : "—", loc: r.location_name || "—", price: r.unit_price || "—",
          total: money(r.display_total), paid: money(r.display_paid), due: money(r.display_due), bal: money(r.running_balance),
          inv: r.invoice_number || "—", notes: r.notes || "—", docUrl: docsMap[r.op_number]?.[0]?.file_url,
        }));
      } else if (shapeKey === "due") {
        titleAr = "كشف الرصيد المستحق"; titleEn = "Balance Due Statement";
        columns = [{ key: "num", ar: "#", en: "#" }, { key: "date", ar: "التاريخ", en: "Date" }, { key: "op", ar: "العملية", en: "Transaction" }, { key: "amount", ar: "المبلغ", en: "Amount" }, { key: "bal", ar: "الرصيد المستحق", en: "Balance" }];
        rows = filterByPeriod(ledger.rows).map((r, i) => ({
          num: i + 1,
          date: fmtDateTime(r.date).date,
          op: r.item_name ? `${r.op_type_name} ${r.item_name} ${r.qty || ""} لتر × ${r.unit_price || ""} بقيمة ${money(r.display_total)}` : `${r.op_type_name} — ${money(Math.abs(r.delta))}`,
          amount: money(r.delta), bal: money(r.running_balance),
        }));
      } else if (shapeKey === "general1") {
        titleAr = "كشف عام 1"; titleEn = "General Statement 1";
        columns = [{ key: "num", ar: "#", en: "#" }, { key: "date", ar: "التاريخ", en: "Date" }, { key: "item", ar: "الصنف", en: "Item" }, { key: "price", ar: "السعر", en: "Price" }, { key: "total", ar: "الإجمالي", en: "Total" }, { key: "paid", ar: "المدفوع", en: "Paid" }, { key: "due", ar: "المتبقي", en: "Due" }, { key: "__doc__", ar: "المستندات", en: "Docs" }, { key: "notes", ar: "ملاحظات", en: "Notes" }];
        rows = filterByPeriod(ledger.rows).map((r, i) => ({ num: i + 1, date: fmtDateTime(r.date).date, item: r.item_name || r.op_type_name, price: r.unit_price || "—", total: money(r.display_total), paid: money(r.display_paid), due: money(r.display_due), notes: r.notes || "—", docUrl: docsMap[r.op_number]?.[0]?.file_url }));
      } else if (shapeKey === "lahwalayh") {
        titleAr = "كشف له وعليه"; titleEn = "Debit-Credit Statement";
        columns = [{ key: "num", ar: "#", en: "#" }, { key: "date", ar: "التاريخ", en: "Date" }, { key: "op", ar: "العملية", en: "Transaction" }, { key: "total", ar: "الإجمالي", en: "Total" }, { key: "paid", ar: "المدفوع", en: "Paid" }, { key: "due", ar: "المتبقي", en: "Due" }, { key: "inv", ar: "الفاتورة", en: "Invoice" }, { key: "notes", ar: "ملاحظات", en: "Notes" }];
        rows = filterByPeriod(ledger.rows).map((r, i) => ({ num: i + 1, date: fmtDateTime(r.date).date, op: r.item_name ? `${r.op_type_name} ${r.item_name} ${r.qty || ""} لتر × ${r.unit_price || ""} بقيمة ${money(r.display_total)}` : r.op_type_name, total: money(r.display_total), paid: money(r.display_paid), due: money(r.display_due), inv: r.invoice_number || "—", notes: r.notes || "—" }));
      } else if (shapeKey === "general2") {
        titleAr = "كشف عام 2"; titleEn = "General Statement 2";
        columns = [{ key: "num", ar: "#", en: "#" }, { key: "date", ar: "التاريخ", en: "Date" }, { key: "item", ar: "الصنف", en: "Item" }, { key: "price", ar: "السعر", en: "Price" }, { key: "total", ar: "الإجمالي", en: "Total" }, { key: "paid", ar: "المدفوع", en: "Paid" }, { key: "due", ar: "المتبقي", en: "Due" }, { key: "notes", ar: "ملاحظات", en: "Notes" }];
        rows = filterByPeriod(ledger.rows).map((r, i) => ({ num: i + 1, date: fmtDateTime(r.date).date, item: r.item_name || r.op_type_name, price: r.unit_price || "—", total: money(r.display_total), paid: money(r.display_paid), due: money(r.display_due), notes: r.notes || "—" }));
      }

      await generateShapedStatement({ shapeTitleAr: titleAr, shapeTitleEn: titleEn, partyName: customer.name, partyLabel: "Customer / العميل", periodText: periodLabel, columns, rows, totalsRows, itemTotals: shapeKey === "matching" || shapeKey === "general1" ? itemTotals : null, landscape: true });
    } catch (e) {
      alert("تعذّر إنشاء الكشف: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 4 }}>{customer.name}</h1>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: COLORS.textDim }}>صفحة العميل</div>
        <button onClick={() => setShowPicker(true)} disabled={exporting} style={{ background: COLORS.gradGold, color: COLORS.bg, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {exporting ? "⏳..." : "📄 طلب كشف"}
        </button>
      </div>

      <div style={{ background: COLORS.panel, borderRadius: 14, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>إجمالي المستحق</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10, color: COLORS.text }}>{money(ledger.totalDue)}</div>
        <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 4 }}>المدفوع</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gold, marginBottom: 10 }}>{money(ledger.totalPaid)}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: dir.icon === "🔴" ? COLORS.red : COLORS.green }}>{dir.icon} {dir.text}{dir.amount ? `: ${money(dir.amount)}` : ""}</div>
      </div>

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: COLORS.text }}>كشف مطابقة (مباشر)</h2>
      {ledger.rows.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>لا توجد عمليات بعد.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 700 }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {["#", "التاريخ", "العملية", "الصنف", "الكمية", "السعر", "الإجمالي", "المدفوع", "المتبقي", "الرصيد", "مستند", ""].map((h) => (
                  <th key={h} style={{ padding: 6, color: COLORS.gold, border: `1px solid ${COLORS.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.rows.map((r, i) => {
                const docs = docsMap[r.op_number] || [];
                return (
                  <tr key={r.op_number + i} style={{ background: i % 2 ? COLORS.panelLight : "transparent" }}>
                    <td style={cellStyle}>{i + 1}</td>
                    <td style={cellStyle}>{fmtDateTime(r.date).date}</td>
                    <td style={cellStyle}>{r.op_type_name}</td>
                    <td style={cellStyle}>{r.item_name || "—"}</td>
                    <td style={cellStyle}>{r.qty ? Number(r.qty).toLocaleString() : "—"}</td>
                    <td style={cellStyle}>{r.unit_price || "—"}</td>
                    <td style={cellStyle}>{money(r.display_total)}</td>
                    <td style={cellStyle}>{money(r.display_paid)}</td>
                    <td style={cellStyle}>{money(r.display_due)}</td>
                    <td style={cellStyle}>{money(r.running_balance)}</td>
                    <td style={cellStyle}>{docs.length ? <a href={docs[0].file_url} target="_blank" rel="noreferrer" style={{ color: COLORS.gold }}>📎</a> : "—"}</td>
                    <td style={cellStyle}>
                      {r.op_number !== "OPENING" && (
                        <button onClick={() => deleteRow(r)} style={{ background: "transparent", border: `1px solid ${COLORS.red}`, color: COLORS.red, borderRadius: 6, padding: "2px 6px", fontSize: 10, cursor: "pointer" }}>حذف</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showPicker && (
        <div onClick={() => setShowPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.panel, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: 16 }}>
            <div style={{ fontWeight: 800, color: COLORS.gold, marginBottom: 12 }}>اختر شكل الكشف</div>
            <div style={{ background: COLORS.panelLight, borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>فترة الكشف (اتركها فارغة للكشف الكامل)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <label style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>من</div>
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.text, fontSize: 12 }} />
                </label>
                <label style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>إلى</div>
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.text, fontSize: 12 }} />
                </label>
              </div>
              {(fromDate || toDate) && (
                <button onClick={() => { setFromDate(""); setToDate(""); }} style={{ marginTop: 8, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textDim, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                  مسح الفترة (كشف كامل)
                </button>
              )}
            </div>
            {SHAPES.map((s) => (
              <div key={s.key} onClick={() => exportShape(s.key)} style={{ padding: 12, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, cursor: "pointer" }}>{s.label}</div>
            ))}
            <div onClick={() => setShowPicker(false)} style={{ textAlign: "center", padding: 10, color: COLORS.red, cursor: "pointer" }}>إلغاء</div>
          </div>
        </div>
      )}

      {textualMsg && (
        <div onClick={() => setTextualMsg("")} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
          <div style={{ background: COLORS.panel, padding: 20, borderRadius: 14, maxWidth: 320, whiteSpace: "pre-line", color: COLORS.text, textAlign: "center", border: `1px solid ${COLORS.gold}` }}>{textualMsg}</div>
        </div>
      )}
    </div>
  );
}

const cellStyle = { padding: 6, textAlign: "center", border: `1px solid ${COLORS.border}`, color: COLORS.text };
