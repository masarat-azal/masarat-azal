import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function money(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " ريال";
}

/**
 * ينشئ كشف حساب PDF بعرض HTML حقيقي (يدعم العربية بشكل صحيح تمامًا)،
 * يحوّله لصورة عبر html2canvas، ثم يضمّه في ملف PDF عبر jsPDF، وينزّله مباشرة.
 * items: [{ date, description, amount, effect, hasDoc }]
 */
export async function generateStatementPDF({ partyName, partyLabel, items, totalDue, totalPaid, balanceText, balanceAmount }) {
  const GOLD = "#D4AF37";
  const DARK = "#0A1A1A";
  const PANEL = "#132424";
  const TEXT = "#1a1a1a";
  const GREY = "#6e7878";
  const BAND = "#f2f2f2";

  const rowsHtml = items
    .map((item, i) => {
      const isNeg = item.effect === -1;
      const amountText = (isNeg ? "- " : "") + money(item.amount);
      const bg = i % 2 === 0 ? "#ffffff" : BAND;
      const docBadge = item.hasDoc ? ' <span style="color:#8a6d1a;font-size:9px;">📎 مرفق</span>' : "";
      return `
        <tr style="background:${bg}">
          <td style="padding:8px 10px;text-align:right;font-size:11px;color:${TEXT}">${item.date || ""}</td>
          <td style="padding:8px 10px;text-align:right;font-size:11px;color:${TEXT}">${item.description || ""}${docBadge}</td>
          <td style="padding:8px 10px;text-align:left;font-size:11px;color:${isNeg ? "#B94A48" : TEXT};font-weight:${isNeg ? "700" : "400"}">${amountText}</td>
        </tr>`;
    })
    .join("");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.background = "#ffffff";
  container.style.fontFamily = "Tahoma, Arial, sans-serif";
  container.dir = "rtl";

  container.innerHTML = `
    <div style="background:${DARK};padding:22px 30px;position:relative;">
      <div style="border-bottom:3px solid ${GOLD};padding-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="text-align:left;color:#c8c8c8;font-size:11px;line-height:1.8;">
          <div>Statement Date: ${new Date().toLocaleDateString("en-GB")}</div>
          <div>${partyLabel}: ${partyName}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:${GOLD};font-size:22px;font-weight:800;">Masarat Azal</div>
          <div style="color:#e8e8e8;font-size:12px;font-weight:700;">مسارات أزل للنقليات</div>
        </div>
      </div>
    </div>

    <div style="padding:24px 30px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:${PANEL};">
            <th style="padding:10px;color:#fff;font-size:11px;text-align:right;">التاريخ</th>
            <th style="padding:10px;color:#fff;font-size:11px;text-align:right;">الوصف</th>
            <th style="padding:10px;color:#fff;font-size:11px;text-align:left;">المبلغ</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="margin-top:24px;width:280px;margin-right:0;margin-left:auto;">
        <div style="display:flex;justify-content:space-between;background:${BAND};padding:10px 14px;font-size:12px;font-weight:700;color:${TEXT};">
          <span>إجمالي المستحق</span><span>${money(totalDue)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;background:${BAND};padding:10px 14px;font-size:12px;font-weight:700;color:#8a6d1a;margin-top:2px;">
          <span>إجمالي المدفوع</span><span>${money(totalPaid)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;background:${GOLD};padding:12px 14px;font-size:13px;font-weight:800;color:#fff;margin-top:2px;">
          <span>${balanceText}</span><span>${money(balanceAmount)}</span>
        </div>
      </div>

      <div style="text-align:center;margin-top:40px;padding-top:14px;border-top:1px solid #ddd;color:${GREY};font-size:10px;">
        <div>هذا الكشف تمت مراجعته من قِبل المختص</div>
        <div style="font-style:italic;margin-top:2px;">This statement has been reviewed by the specialist — Masarat Azal</div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Statement-${partyName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
