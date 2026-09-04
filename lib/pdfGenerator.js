import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const GOLD = "#D4A72C";
const GREEN = "#174A3A";
const SILVER = "#D9DEE1";
const TEXT = "#263238";
const BAND = "#F3F5F6";

const HEADER_H = 30; // px — ثابت لضمان حساب دقيق لموضع الرابط القابل للضغط
const ROW_H = 26; // px — ثابت لنفس السبب

function fmtMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ريال";
}

/**
 * ينشئ كشف PDF بأعمدة مرنة حسب الشكل المطلوب، مع روابط مستندات قابلة للضغط فعليًا.
 * columns: [{ key, ar, en, align }]
 * rows: [{ ...values, docUrl?: string }]
 * totalsRows: [{ label, value, highlight? }]
 * itemTotals: [{ item, qty, amount }] (اختياري، لجدول إجمالي الأصناف)
 */
export async function generateShapedStatement({ shapeTitleAr, shapeTitleEn, partyName, partyLabel, periodText, columns, rows, totalsRows, itemTotals, landscape }) {
  const pageWidthPx = landscape ? 1100 : 800;

  const headerCellsHtml = columns
    .map(
      (c) => `<th style="padding:0 4px;color:#fff;font-size:10px;text-align:center;vertical-align:middle;">${c.ar}<div style="font-size:8px;font-weight:400;opacity:0.85;">${c.en}</div></th>`
    )
    .join("");

  let rowsHtml = "";
  const linkPositions = []; // { rowIndex, url }

  rows.forEach((r, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : BAND;
    const cells = columns
      .map((c) => {
        if (c.key === "__doc__") {
          if (r.docUrl) linkPositions.push({ rowIndex: i, url: r.docUrl });
          return `<td style="padding:0 4px;text-align:center;font-size:10px;color:${r.docUrl ? GREEN : "#999"};text-decoration:${r.docUrl ? "underline" : "none"};">${r.docUrl ? "📎 مرفق" : "—"}</td>`;
        }
        const val = r[c.key] ?? "—";
        const small = c.key === "notes" ? "font-size:8px;color:#777;" : "font-size:10px;";
        return `<td style="padding:0 4px;text-align:center;${small}">${val}</td>`;
      })
      .join("");
    rowsHtml += `<tr style="background:${bg};height:${ROW_H}px;">${cells}</tr>`;
  });

  let totalsHtml = "";
  if (totalsRows && totalsRows.length) {
    totalsHtml = `<div style="width:300px;margin-right:0;margin-left:auto;margin-top:14px;">`;
    totalsRows.forEach((t) => {
      totalsHtml += `<div style="display:flex;justify-content:space-between;padding:7px 12px;font-size:11px;font-weight:700;background:${t.highlight ? GOLD : BAND};color:${t.highlight ? "#fff" : TEXT};margin-top:2px;">
        <span>${t.label}</span><span>${t.value}</span>
      </div>`;
    });
    totalsHtml += `</div>`;
  }

  let itemTotalsHtml = "";
  if (itemTotals && itemTotals.length) {
    itemTotalsHtml = `<table style="width:100%;border-collapse:collapse;margin-top:16px;">
      <tr style="background:${BAND};"><th style="padding:6px;font-size:10px;">الصنف / Item</th><th style="padding:6px;font-size:10px;">إجمالي الكمية / Qty</th><th style="padding:6px;font-size:10px;">إجمالي المبلغ / Amount</th></tr>
      ${itemTotals.map((it) => `<tr><td style="padding:6px;text-align:center;font-size:10px;">${it.item}</td><td style="padding:6px;text-align:center;font-size:10px;">${it.qty}</td><td style="padding:6px;text-align:center;font-size:10px;">${it.amount}</td></tr>`).join("")}
    </table>`;
  }

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = pageWidthPx + "px";
  container.style.background = "#ffffff";
  container.style.fontFamily = "Tahoma, Arial, sans-serif";
  container.dir = "rtl";

  container.innerHTML = `
    <div style="background:${GREEN};padding:20px 26px;">
      <div style="border-bottom:3px solid ${GOLD};padding-bottom:12px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="text-align:left;color:#d8d8d8;font-size:10px;line-height:1.8;">
          <div>Issued / تاريخ الإصدار: ${new Date().toLocaleDateString("en-GB")}</div>
          <div>Period / الفترة: ${periodText}</div>
          <div>${partyLabel}: ${partyName}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:${GOLD};font-size:20px;font-weight:800;">Masarat Azal</div>
          <div style="color:#eee;font-size:11px;font-weight:700;">مسارات أزل</div>
        </div>
      </div>
    </div>
    <div style="padding:18px 24px;position:relative;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:70px;font-weight:900;color:${GOLD};opacity:0.05;pointer-events:none;">مسارات أزل</div>
      <div style="position:relative;">
        <div style="background:${GREEN};color:#fff;padding:6px 12px;font-weight:800;font-size:13px;margin-bottom:8px;">${shapeTitleAr} / ${shapeTitleEn}</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:${GREEN};height:${HEADER_H}px;">${headerCellsHtml}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${totalsHtml}
        ${itemTotalsHtml}
        <div style="text-align:center;margin-top:26px;padding-top:10px;border-top:1px solid #ddd;color:#777;font-size:9px;">
          <div>هذا الكشف تمت مراجعته من قِبل المختص</div>
          <div style="font-style:italic;">This statement has been reviewed by the specialist — Masarat Azal</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(container);

  try {
    const scale = 2;
    const canvas = await html2canvas(container, { scale, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: landscape ? "landscape" : "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pxToPt = imgWidth / canvas.width; // نسبة تحويل بكسل HTML إلى نقاط PDF (تشمل scale الـ html2canvas ضمنيًا عبر نسبة canvas.width)

    let heightLeft = imgHeight;
    let position = 0;
    let pageIndex = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      pageIndex++;
    }

    // حساب مواضع روابط المستندات القابلة للضغط بناءً على ارتفاعات ثابتة للرأس والصفوف
    // الإزاحة التقريبية لأعلى الجدول داخل الصفحة (رأس الشركة + هامش + عنوان الشكل) بوحدة px قبل التحجيم
    const TABLE_TOP_OFFSET_PX = 132; // يمكن معايرته يدويًا لو اختلف قليلًا حسب المحتوى
    const docColIndex = columns.findIndex((c) => c.key === "__doc__");
    if (docColIndex >= 0) {
      const colWidthPx = pageWidthPx / columns.length;
      linkPositions.forEach(({ rowIndex, url }) => {
        const yPx = TABLE_TOP_OFFSET_PX + HEADER_H + rowIndex * ROW_H;
        const xPx = docColIndex * colWidthPx;
        const yPt = yPx * pxToPt * scale;
        const xPt = xPx * pxToPt * scale;
        const rowHPt = ROW_H * pxToPt * scale;
        const colWPt = colWidthPx * pxToPt * scale;

        const targetPage = Math.floor(yPt / pageHeight) + 1;
        const yOnPage = yPt - (targetPage - 1) * pageHeight;
        try {
          pdf.setPage(targetPage);
          pdf.link(xPt, yOnPage, colWPt, rowHPt, { url });
        } catch (e) {}
      });
    }

    const fileName = `${shapeTitleAr}-${partyName}-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(fileName);
  } finally {
    document.body.removeChild(container);
  }
}

/** كشف سريع — صورة PNG بلا شعار، جدول مبسّط فقط. */
export async function generateQuickImage({ partyName, rows, totalsRows }) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.width = "600px";
  container.style.background = "#ffffff";
  container.style.fontFamily = "Tahoma, Arial, sans-serif";
  container.dir = "rtl";

  const rowsHtml = rows
    .map(
      (r, i) => `<tr style="background:${i % 2 === 0 ? "#fff" : BAND};">
      <td style="padding:8px;text-align:center;font-size:12px;">${r.date}</td>
      <td style="padding:8px;text-align:center;font-size:12px;">${r.item}</td>
      <td style="padding:8px;text-align:center;font-size:12px;">${r.price}</td>
      <td style="padding:8px;text-align:center;font-size:12px;">${r.total}</td>
      <td style="padding:8px;text-align:center;font-size:12px;">${r.paid}</td>
      <td style="padding:8px;text-align:center;font-size:12px;">${r.due}</td>
    </tr>`
    )
    .join("");

  const totalsHtml = totalsRows
    .map(
      (t) => `<div style="display:flex;justify-content:space-between;padding:8px 12px;font-size:12px;font-weight:700;background:${t.highlight ? GOLD : BAND};color:${t.highlight ? "#fff" : TEXT};margin-top:2px;">
      <span>${t.label}</span><span>${t.value}</span>
    </div>`
    )
    .join("");

  container.innerHTML = `
    <div style="padding:16px;">
      <div style="text-align:center;font-weight:800;color:${GREEN};font-size:15px;margin-bottom:10px;">كشف سريع — ${partyName}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr style="background:${GREEN};color:#fff;">
          <th style="padding:8px;font-size:11px;">التاريخ</th><th style="padding:8px;font-size:11px;">الصنف</th><th style="padding:8px;font-size:11px;">السعر</th>
          <th style="padding:8px;font-size:11px;">الإجمالي</th><th style="padding:8px;font-size:11px;">المدفوع</th><th style="padding:8px;font-size:11px;">المستحق</th>
        </tr>
        ${rowsHtml}
      </table>
      <div style="width:260px;margin-right:0;margin-left:auto;margin-top:10px;">${totalsHtml}</div>
    </div>
  `;
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    link.download = `كشف-سريع-${partyName}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } finally {
    document.body.removeChild(container);
  }
}

export { fmtMoney as money };
