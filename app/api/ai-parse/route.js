export async function POST(req) {
  try {
    const body = await req.json();
    const { text, image, mimeType, customers, suppliers, products, locations } = body;
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      return Response.json({ error: "GEMINI_API_KEY غير مضبوط في إعدادات الخادم" }, { status: 500 });
    }

    const locationsList = (locations || []).join("، ") || "لا توجد مواقع مسجّلة";

    const basePrompt = `أنت مساعد محاسبي لشركة نقل ديزل. حلّل ${image ? "الصورة أو المستند المرفق (فاتورة أو إيصال أو سند)" : "الرسالة التالية"} وأخرج JSON فقط بلا أي نص إضافي، بلا علامات ماركداون وبلا شرح.

العملاء المعروفون: ${(customers || []).join("، ") || "—"}
الموردون المعروفون: ${(suppliers || []).join("، ") || "—"}
الأصناف المعروفة: ${(products || []).join("، ") || "—"}
المواقع المسجّلة في النظام: ${locationsList}
تاريخ اليوم: ${new Date().toISOString().slice(0, 10)}

أخرج بالضبط هذا الشكل:
{"type":"بيع|شراء|دفعة_من_عميل|دفعة_لمورد|مصروف|غير_مفهوم",
 "party_name":"","date":"YYYY-MM-DD","location_name":"","product_name":"",
 "quantity":null,"unit_price":null,"amount":null,"fees":null,
 "invoice_number":"","missing":[]}

قواعد صارمة:
- لا تخترع رقمًا أو اسمًا غير مذكور صراحة أو غير واضح في الصورة. الحقل غير الواضح = null، واذكره في "missing".
- **الموقع (location_name): لا تكتب فيه إلا اسمًا موجودًا حرفيًا في قائمة "المواقع المسجّلة في النظام" أعلاه. إن لم تجد تطابقًا واضحًا مع أحد تلك الأسماء بالضبط، اتركه فارغًا تمامًا "" وأضف "الموقع" في missing. ممنوع منعًا باتًا اختراع اسم موقع أو استنتاجه من نص السند إن لم يكن ضمن القائمة.**
- **لا تكتب أي شيء في حقل الملاحظات إطلاقًا — هذا الحقل للمستخدم وحده، وغير مطلوب منك أصلًا.**
- إن كانت الصورة تحتوي شعار شركة مطبوعًا في الترويسة، استخدم اسم تلك الشركة كـ"party_name" لا أي اسم مكتوب بخط اليد.
- طابق أسماء الأطراف والأصناف مع القوائم أعلاه ولو اختلف الإملاء قليلًا.
- بلا تاريخ مذكور = تاريخ اليوم.
- "20 ألف" = 20000.
- الخط اليدوي غير الواضح: لا تخمّن رقمًا.
- لو كانت الرسالة طلب كشف أو تقرير وليست عملية فعلية، اجعل type="غير_مفهوم".
${!image ? `\nالرسالة: ${text}` : ""}`;

    const parts = [{ text: basePrompt }];
    if (image) {
      parts.push({ inline_data: { mime_type: mimeType || "image/jpeg", data: image } });
    }

    const models = [
      "gemini-2.5-flash",
      "gemini-flash-latest"
    ];
    let lastErr = "";

    for (const model of models) {
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
          return Response.json({ error: "لم يفهم الذكاء الاصطناعي المحتوى" }, { status: 422 });
        }

        const parsed = JSON.parse(match[0]);

        // حماية من طرف الخادم: نلغي أي موقع غير موجود فعليًا في القائمة
        if (parsed.location_name) {
          const norm = (s) => String(s || "").trim().toLowerCase();
          const known = (locations || []).some((l) => norm(l) === norm(parsed.location_name));
          if (!known) {
            parsed.location_name = "";
            parsed.missing = Array.isArray(parsed.missing) ? parsed.missing : [];
            if (!parsed.missing.includes("الموقع")) parsed.missing.push("الموقع");
          }
        }

        // نمسح أي ملاحظات كتبها النموذج — الحقل للمستخدم وحده
        delete parsed.notes;

        return Response.json(parsed);
      }
      lastErr = `HTTP ${res.status} [${model}] ${(await res.text()).slice(0, 150)}`;
      // نتخطى فورًا للنموذج التالي عند: غير موجود (404)، تجاوز الحصة (429)، أو ازدحام مؤقت (503)
      if (res.status !== 404 && res.status !== 429 && res.status !== 503) break;
    }
    return Response.json({ error: "تعذر الوصول للذكاء الاصطناعي: " + lastErr }, { status: 502 });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
