"use client";
import React, { useEffect, useState } from "react";
import { buildGlobalLedger } from "../../../lib/dataHelpers";
import { COLORS, money, fmtDateTime } from "../../../lib/theme";

export default function PurchasesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const data = await buildGlobalLedger("supplier");
      setRows(data);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>المشتريات — كشف المعاينة</h1>
      {loading ? (
        <div style={{ color: COLORS.textDim }}>جاري التحميل…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: COLORS.textDim }}>لا توجد عمليات بعد.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ background: COLORS.panel }}>
                {["#", "رقم العملية", "التاريخ", "المورد", "العملية", "الصنف", "الكمية", "الموقع", "السعر", "الإجمالي", "المدفوع", "المتبقي", "الفاتورة", "ملاحظات"].map((h) => (
                  <th key={h} style={{ padding: 8, color: COLORS.gold, border: `1px solid ${COLORS.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const { date, time } = fmtDateTime(r.created_at || r.date);
                return (
                  <tr key={r.op_number + i} style={{ background: i % 2 ? COLORS.panelLight : "transparent" }}>
                    <td style={cellStyle}>{i + 1}</td>
                    <td style={cellStyle}>{r.op_number}</td>
                    <td style={cellStyle}>{date}<br /><small style={{ color: COLORS.textDim }}>{time}</small></td>
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
                    <td style={{ ...cellStyle, fontSize: 10, color: COLORS.textDim, maxWidth: 100 }}>{r.notes || "—"}</td>
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

const cellStyle = { padding: 7, textAlign: "center", border: `1px solid ${COLORS.border}`, color: COLORS.text };
