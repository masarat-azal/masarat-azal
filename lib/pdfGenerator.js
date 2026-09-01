import { jsPDF } from "jspdf";

const GOLD = [212, 175, 55];
const DARK = [10, 26, 26];
const PANEL = [19, 36, 36];
const TEXT = [30, 30, 30];
const GREY = [110, 120, 120];

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " SAR";
}

/**
 * ينشئ كشف حساب PDF لعميل أو مورد ويُنزّله مباشرة على الجهاز.
 * items: مصفوفة صفوف [{ date, description, amount, type }]
 */
export function generateStatementPDF({ partyName, partyLabel, items, totalDue, totalPaid, balanceText, balanceAmount }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;

  // ===== ترويسة =====
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 90, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 88, pageWidth, 3, "F");

  doc.setTextColor(...GOLD);
  doc.setFontSize(20);
  doc.text("Masarat Azal", pageWidth - margin, 38, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(230, 230, 230);
  doc.text("مسارات أزل للنقليات", pageWidth - margin, 56, { align: "right" });

  doc.setFontSize(9);
  doc.setTextColor(180, 180, 180);
  doc.text(`Statement Date: ${new Date().toLocaleDateString("en-GB")}`, margin, 38);
  doc.text(`${partyLabel}: ${partyName}`, margin, 54);

  // ===== جدول =====
  let y = 120;
  doc.setFillColor(...PANEL);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text("Date", margin + 10, y + 15);
  doc.text("Description", margin + 90, y + 15);
  doc.text("Amount", pageWidth - margin - 10, y + 15, { align: "right" });
  y += 22;

  doc.setFontSize(9);
  items.forEach((item, i) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
    }
    const bg = i % 2 === 0 ? [245, 245, 245] : [255, 255, 255];
    doc.setFillColor(...bg);
    doc.rect(margin, y, pageWidth - margin * 2, 20, "F");
    doc.setTextColor(...TEXT);
    doc.text(String(item.date || ""), margin + 10, y + 14);
    doc.text(String(item.description || "").slice(0, 55), margin + 90, y + 14);
    const isNeg = item.effect === -1;
    doc.setTextColor(isNeg ? 200 : 30, isNeg ? 60 : 30, isNeg ? 60 : 30);
    doc.text((isNeg ? "- " : "") + money(item.amount), pageWidth - margin - 10, y + 14, { align: "right" });
    y += 20;
  });

  // ===== الإجماليات =====
  y += 20;
  const boxW = 260;
  const boxX = pageWidth - margin - boxW;

  doc.setFillColor(245, 245, 245);
  doc.rect(boxX, y, boxW, 24, "F");
  doc.setTextColor(...TEXT);
  doc.setFontSize(10);
  doc.text("Total Due / إجمالي المستحق", boxX + 10, y + 16);
  doc.text(money(totalDue), boxX + boxW - 10, y + 16, { align: "right" });
  y += 24;

  doc.setFillColor(245, 245, 245);
  doc.rect(boxX, y, boxW, 24, "F");
  doc.setTextColor(...GOLD.map((c) => c * 0.6));
  doc.text("Total Paid / إجمالي المدفوع", boxX + 10, y + 16);
  doc.text(money(totalPaid), boxX + boxW - 10, y + 16, { align: "right" });
  y += 24;

  doc.setFillColor(...GOLD);
  doc.rect(boxX, y, boxW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(balanceText, boxX + 10, y + 18);
  doc.text(money(balanceAmount), boxX + boxW - 10, y + 18, { align: "right" });

  // ===== تذييل =====
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setTextColor(...GREY);
  doc.setFontSize(8);
  doc.text("This statement has been reviewed by the specialist — Masarat Azal", pageWidth / 2, pageHeight - 25, { align: "center" });

  doc.save(`Statement-${partyName}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
