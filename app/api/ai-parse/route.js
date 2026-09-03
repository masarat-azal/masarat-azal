export async function POST(req) {
  try {
    const body = await req.json();
    const { text, image, mimeType, customers, suppliers, products, locations } = body;
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({ error: "GEMINI_API_KEY غير مضبوط في إعدادات الخادم" }, { status: 500 });
    }

    const basePrompt = `أنت مساعد محاسبي لشركة نقل ديزل. حلّل ${image ? "الصورة أو المستند المرفق (فاتورة أو إيصال أو سند)" : "الرسالة التالية"} وأخرج JSON فقط بلا أي نص إضافي، بلا علامات ماركداون وبلا شرح.

العملاء المعروفون: ${(customers || []).join("، ") || "—"}
الموردون المعروفون: ${(suppliers || []).join("، ") || "—"}
الأصناف المعروفة: ${(products || []).join("، ") || "—"}
المواقع المعروفة: ${(locations || []).join("، ") || "—"}
تاريخ اليوم: ${new Date().toISOString().slice(0, 10)}

أخرج بالضبط هذا الشكل:
{"type":"بيع|شراء|دفعة_من_عميل|دفعة_لمورد|مصروف|غير_مفهوم",
 "party_name":"","date":"YYYY-MM-DD","location_name":"","product_name":"",
 "quantity":null,"unit_price":null,"amount":null,"fees":null,
 "invoice_number":"","notes":"","missing":[]}

قواعد صارمة:
- لا تخترع رقمًا أو اسمًا غير مذكور صراحة أو غير واضح في الصورة. الحقل غير الواضح = null، واذكره في "missing".
- إن كانت الصورة تحتوي شعار شركة مطبوعًا في الترويسة، استخدم اسم تلك الشركة كـ"party_name" لا أي اسم مكتوب بخط اليد.
- طابق أسماء الأطراف والأصناف والمواقع مع القوائم أعلاه ولو اختلف الإملاء قليلًا.
- بلا تاريخ مذكور = تاريخ اليوم.
- "20 ألف" = 20000.
- الخط اليدوي غير الواضح: لا تخمّن رقمًا.
${!image ? `\nالرسالة: ${text}` : ""}`;

    const parts = [{ text: basePrompt }];
    if (image) {
      parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: image } });
    }

    // قائمة نماذج مرتبة من الأحدث/الأسرع، يجرّبها الخادم بالترتيب حتى ينجح أحدها
  const models = [
  "gemini-flash-latest",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
];
    const errors = [];

    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts }] }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
          const cleaned = raw.replace(/```json|```/g, "").trim();
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (!match) {
            errors.push(`[${model}] رد بلا JSON صالح`);
            continue; // جرّب النموذج التالي بدل الفشل الفوري
          }
          return Response.json(JSON.parse(match[0]));
        }

        // أي خطأ HTTP (404 نموذج متوقف، 429 تجاوز حصة، 503 ازدحام، أو غيره) — سجّله وانتقل للنموذج التالي
        const errText = await res.text();
        errors.push(`[${model}] HTTP ${res.status}: ${errText.slice(0, 120)}`);
      } catch (fetchErr) {
        // خطأ شبكة/اتصال لهذا النموذج تحديدًا — لا يوقف المحاولة، ننتقل للتالي
        errors.push(`[${model}] خطأ اتصال: ${fetchErr.message}`);
      }
    }

    // فشلت كل النماذج المتاحة
    return Response.json(
      { error: "تعذر الوصول لأي نموذج ذكاء اصطناعي متاح:\n" + errors.join("\n") },
      { status: 502 }
    );
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
