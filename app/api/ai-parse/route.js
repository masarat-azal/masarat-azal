export async function POST(req) {
  try {
    const { text, customers, suppliers, products, locations } = await req.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({ error: "GEMINI_API_KEY غير مضبوط في إعدادات الخادم" }, { status: 500 });
    }

    const prompt = `أنت مساعد محاسبي لشركة نقل ديزل. حلّل الرسالة التالية وأخرج JSON فقط بلا أي نص إضافي، بلا علامات ماركداون وبلا شرح.

العملاء المعروفون: ${customers.join("، ") || "—"}
الموردون المعروفون: ${suppliers.join("، ") || "—"}
الأصناف المعروفة: ${products.join("، ") || "—"}
المواقع المعروفة: ${locations.join("، ") || "—"}
تاريخ اليوم: ${new Date().toISOString().slice(0, 10)}

أخرج بالضبط هذا الشكل:
{"type":"بيع|شراء|دفعة_من_عميل|دفعة_لمورد|مصروف|غير_مفهوم",
 "party_name":"","date":"YYYY-MM-DD","location_name":"","product_name":"",
 "quantity":null,"unit_price":null,"amount":null,"fees":null,
 "invoice_number":"","notes":"","missing":[]}

قواعد صارمة:
- لا تخترع رقمًا أو اسمًا غير مذكور صراحة. الحقل غير المذكور = null، واذكره في "missing".
- طابق أسماء الأطراف والأصناف والمواقع مع القوائم أعلاه ولو اختلف الإملاء قليلًا.
- بلا تاريخ مذكور = تاريخ اليوم.
- "20 ألف" = 20000.

الرسالة: ${text}`;

    const models = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"];
    let lastErr = "";

    for (const model of models) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
        const cleaned = raw.replace(/```json|```/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (!match) {
          return Response.json({ error: "لم يفهم الذكاء الاصطناعي الرسالة" }, { status: 422 });
        }
        return Response.json(JSON.parse(match[0]));
      }
      lastErr = `HTTP ${res.status} [${model}] ${(await res.text()).slice(0, 150)}`;
      if (res.status !== 404 && res.status !== 429) break;
    }
    return Response.json({ error: "تعذر الوصول للذكاء الاصطناعي: " + lastErr }, { status: 502 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
