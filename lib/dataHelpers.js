import { supabase } from "./supabaseClient";
import { num } from "./theme";

export async function fetchLists() {
  const [{ data: customers }, { data: suppliers }, { data: products }, { data: locations }] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    supabase.from("suppliers").select("*").order("name"),
    supabase.from("products").select("*").order("name"),
    supabase.from("locations").select("*").order("name"),
  ]);
  return {
    customers: customers || [],
    suppliers: suppliers || [],
    products: products || [],
    locations: locations || [],
  };
}

/** أنواع العمليات — كل نوع (حتى الأساسية) له اسم ورمز يُداران من الإعدادات.
 *  system_key يبقى ثابتًا في الكود لتوجيه الحفظ للجدول الصحيح؛ null = نوع مخصص يُحفظ في custom_operations. */
export async function fetchOperationTypes() {
  const { data } = await supabase.from("operation_types").select("*").order("created_at");
  return data || [];
}

export async function addOperationType(name, code) {
  const { data, error } = await supabase.from("operation_types").insert({ name, code, system_key: null }).select().single();
  if (error) throw error;
  return data;
}

export async function updateOperationType(id, { name, code }) {
  const { error } = await supabase.from("operation_types").update({ name, code }).eq("id", id);
  if (error) throw error;
}

/** يبحث عن سعر الموقع المحفوظ مباشرة على الموقع نفسه (كل موقع له اسم فريد وسعره الخاص). */
export async function lookupLocationPrice(locationName) {
  if (!locationName) return null;
  const { data } = await supabase.from("locations").select("unit_price").ilike("name", locationName).limit(1);
  return data && data.length && data[0].unit_price !== null ? Number(data[0].unit_price) : null;
}

/** يتحقق مما إذا كان رقم الفاتورة مستخدمًا من قبل (في المبيعات أو المشتريات). */
export async function checkDuplicateInvoice(invoiceNumber) {
  if (!invoiceNumber || !String(invoiceNumber).trim()) return null;
  const inv = String(invoiceNumber).trim();
  const [{ data: s }, { data: p }] = await Promise.all([
    supabase.from("sales").select("op_number,date,customer_id,customers(name)").eq("invoice_number", inv).limit(1),
    supabase.from("purchases").select("op_number,date,supplier_id,suppliers(name)").eq("invoice_number", inv).limit(1),
  ]);
  if (s && s.length) return { where: "المبيعات", party: s[0].customers?.name || "—", date: s[0].date, op: s[0].op_number };
  if (p && p.length) return { where: "المشتريات", party: p[0].suppliers?.name || "—", date: p[0].date, op: p[0].op_number };
  return null;
}

export function findByName(list, name) {
  if (!name) return null;
  const norm = (s) => String(s || "").trim().toLowerCase();
  return list.find((x) => norm(x.name) === norm(name)) || null;
}

export async function ensureParty(kind, name) {
  const table = kind === "customer" ? "customers" : "suppliers";
  const { data: existing } = await supabase.from(table).select("*").ilike("name", name).limit(1);
  if (existing && existing.length) return existing[0];
  const { data, error } = await supabase.from(table).insert({ name }).select().single();
  if (error) throw error;
  return data;
}

export async function ensureProduct(name) {
  if (!name) return null;
  const { data: existing } = await supabase.from("products").select("*").ilike("name", name).limit(1);
  if (existing && existing.length) return existing[0];
  const { data, error } = await supabase.from("products").insert({ name, behavior: "qty_price" }).select().single();
  if (error) throw error;
  return data;
}

export async function fetchDocumentsForOp(opNumber) {
  if (!opNumber) return [];
  const { data } = await supabase.from("documents").select("*").eq("op_number", opNumber);
  return data || [];
}

export async function fetchDocumentsMap(opNumbers) {
  if (!opNumbers.length) return {};
  const { data } = await supabase.from("documents").select("*").in("op_number", opNumbers);
  const map = {};
  (data || []).forEach((d) => {
    if (!map[d.op_number]) map[d.op_number] = [];
    map[d.op_number].push(d);
  });
  return map;
}

export async function compressImage(file, maxWidth = 1600, quality = 0.75) {
  if (!file.type.startsWith("image/")) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })),
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadDocument(file, opNumber, docType) {
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop();
  const path = `${opNumber}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("documents").upload(path, compressed, { contentType: compressed.type, upsert: false });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("documents").getPublicUrl(path);
  const fileUrl = pub.publicUrl;
  const { error: dbErr } = await supabase.from("documents").insert({ op_number: opNumber, doc_type: docType || compressed.type, file_url: fileUrl });
  if (dbErr) throw dbErr;
  return fileUrl;
}

/** صياغة اتجاه الرصيد بلا لبس. */
export function balanceDirection(isSupplier, balance) {
  if (Math.abs(balance) < 0.001) return { icon: "✅", text: "لا يوجد رصيد مستحق", amount: 0 };
  if (isSupplier) {
    return balance > 0
      ? { icon: "🔴", text: "نحن مدينون للمورد بمبلغ", amount: balance }
      : { icon: "🟢", text: "المورد مدين لنا بمبلغ", amount: -balance };
  }
  return balance > 0
    ? { icon: "🔴", text: "العميل مدين لنا بمبلغ", amount: balance }
    : { icon: "🟢", text: "نحن مدينون للعميل بمبلغ", amount: -balance };
}

/**
 * يبني سجل عمليات طرف واحد (عميل أو مورد) مرتّبًا حسب تاريخ العملية نفسه (لا وقت إدخالها)،
 * مع رصيد مستحق تراكمي محسوب صفًا بصف بنفس هذا الترتيب الزمني — يُعاد حسابه تلقائيًا من البيانات
 * المتبقية عند أي حذف، لأنه لا يُخزَّن كعمود ثابت بل يُشتق دائمًا وقت العرض.
 */
export async function buildPartyLedger(partyType, partyId) {
  const isCustomer = partyType === "customer";
  const mainTable = isCustomer ? "sales" : "purchases";
  const idField = isCustomer ? "customer_id" : "supplier_id";

  const [{ data: mainRows }, { data: customOps }, { data: payments }, { data: openBal }] = await Promise.all([
    supabase.from(mainTable).select("*, products(name), locations(name)").eq(idField, partyId),
    supabase.from("custom_operations").select("*").eq("party_type", partyType).eq("party_id", partyId),
    supabase.from("payments").select("*").eq("party_type", partyType).eq("party_id", partyId),
    supabase.from("opening_balances").select("*").eq("party_type", partyType).eq("party_id", partyId),
  ]);

  const rows = [];

  (mainRows || []).forEach((r) => {
    const total = isCustomer ? Number(r.net_total) || 0 : Number(r.amount) || 0;
    const paidField = Number(r.paid) || 0;
    rows.push({
      _id: r.id,
      date: r.date,
      created_at: r.created_at,
      op_number: r.op_number,
      op_type_name: isCustomer ? "بيع" : "شراء",
      item_name: r.products?.name || "",
      qty: r.quantity,
      location_name: r.locations?.name || "",
      unit_price: r.unit_price,
      display_total: total,
      display_paid: paidField,
      display_due: total - paidField,
      delta: total - paidField,
      invoice_number: r.invoice_number,
      notes: r.notes,
    });
  });

  (customOps || []).forEach((o) => {
    const amt = Number(o.amount) || 0;
    const isAdd = o.effect > 0;
    rows.push({
      _id: o.id,
      date: o.date,
      created_at: o.created_at,
      op_number: o.op_number,
      op_type_name: o.type_name,
      item_name: "",
      qty: null,
      location_name: "",
      unit_price: null,
      display_total: isAdd ? amt : 0,
      display_paid: isAdd ? 0 : amt,
      display_due: o.effect * amt,
      delta: o.effect * amt,
      invoice_number: null,
      notes: o.description,
      reference_number: o.reference_number,
    });
  });

  (payments || []).forEach((p) => {
    const amt = Number(p.amount) || 0;
    rows.push({
      _id: p.id,
      date: p.date,
      created_at: p.created_at,
      op_number: p.op_number,
      op_type_name: isCustomer ? "دفعة من عميل" : "دفعة لمورد",
      item_name: "",
      qty: null,
      location_name: "",
      unit_price: null,
      display_total: 0,
      display_paid: amt,
      display_due: -amt,
      delta: -amt,
      invoice_number: null,
      notes: p.notes,
    });
  });

  (openBal || []).forEach((b) => {
    const amt = Number(b.amount) || 0;
    rows.push({
      date: b.date,
      created_at: b.created_at,
      op_number: "OPENING",
      op_type_name: "رصيد افتتاحي",
      item_name: "",
      qty: null,
      location_name: "",
      unit_price: null,
      display_total: amt > 0 ? amt : 0,
      display_paid: amt < 0 ? -amt : 0,
      display_due: amt,
      delta: amt,
      invoice_number: null,
      notes: b.notes,
    });
  });

  // الترتيب الزمني الحقيقي: حسب تاريخ العملية، لا وقت إدخالها في النظام
  rows.sort((a, b) => new Date(a.date) - new Date(b.date) || new Date(a.created_at) - new Date(b.created_at));

  let running = 0;
  rows.forEach((r) => {
    running += r.delta;
    r.running_balance = running;
  });

  const totalDue = rows.reduce((s, r) => s + r.display_total, 0);
  const totalPaid = rows.reduce((s, r) => s + r.display_paid, 0);
  const balance = running;

  const byItem = {};
  rows.forEach((r) => {
    if (!r.item_name) return;
    if (!byItem[r.item_name]) byItem[r.item_name] = { qty: 0, amount: 0 };
    byItem[r.item_name].qty += Number(r.qty) || 0;
    byItem[r.item_name].amount += r.display_total;
  });

  return { rows: rows.slice().reverse(), rowsAsc: rows, totalDue, totalPaid, balance, byItem };
}

/** أغلفة مبسّطة تُرجع رصيد طرف واحد فقط (تُستخدم في قوائم العملاء/الموردين لتفادي بناء السجل الكامل لكل شخص عند العرض السريع). */
export async function getCustomerBalance(customerId) {
  const l = await buildPartyLedger("customer", customerId);
  return { balance: l.balance, totalDue: l.totalDue, totalPaid: l.totalPaid };
}
export async function getSupplierBalance(supplierId) {
  const l = await buildPartyLedger("supplier", supplierId);
  return { balance: l.balance, totalDue: l.totalDue, totalPaid: l.totalPaid };
}

/** كشف المعاينة الشامل — كل الأطراف من نوع واحد معًا (صفحة المبيعات أو صفحة المشتريات). */
export async function buildGlobalLedger(partyType) {
  const isCustomer = partyType === "customer";
  const partyTable = isCustomer ? "customers" : "suppliers";
  const { data: parties } = await supabase.from(partyTable).select("id,name");
  const all = [];
  for (const p of parties || []) {
    const ledger = await buildPartyLedger(partyType, p.id);
    ledger.rowsAsc.forEach((r) => all.push({ ...r, party_name: p.name }));
  }
  all.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.created_at) - new Date(a.created_at));
  return all;
}

/** حذف عملية واحدة من أي جدول أساسي — الأرصدة تُعاد حسابها تلقائيًا لأنها تُشتق وقت العرض دائمًا. */
export async function deleteSale(id) {
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}
export async function deletePurchase(id) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteCustomOperation(id) {
  const { error } = await supabase.from("custom_operations").delete().eq("id", id);
  if (error) throw error;
}
export async function deletePayment(id) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}

/** حذف عميل أو مورد مع كل عملياته ومستنداته نهائيًا (الخيار الذي اختاره المستخدم: حذف كامل متسلسل). */
export async function deletePartyCascade(partyType, partyId) {
  const isCustomer = partyType === "customer";
  const mainTable = isCustomer ? "sales" : "purchases";
  const idField = isCustomer ? "customer_id" : "supplier_id";

  // نجمع أرقام العمليات أولًا لحذف مستنداتها المرتبطة
  const [{ data: mainRows }, { data: customOps }, { data: payments }] = await Promise.all([
    supabase.from(mainTable).select("op_number").eq(idField, partyId),
    supabase.from("custom_operations").select("op_number").eq("party_type", partyType).eq("party_id", partyId),
    supabase.from("payments").select("op_number").eq("party_type", partyType).eq("party_id", partyId),
  ]);
  const opNumbers = [
    ...(mainRows || []).map((r) => r.op_number),
    ...(customOps || []).map((r) => r.op_number),
    ...(payments || []).map((r) => r.op_number),
  ].filter(Boolean);

  if (opNumbers.length) {
    await supabase.from("documents").delete().in("op_number", opNumbers);
  }
  await supabase.from(mainTable).delete().eq(idField, partyId);
  await supabase.from("custom_operations").delete().eq("party_type", partyType).eq("party_id", partyId);
  await supabase.from("payments").delete().eq("party_type", partyType).eq("party_id", partyId);
  await supabase.from("opening_balances").delete().eq("party_type", partyType).eq("party_id", partyId);

  const partyTable = isCustomer ? "customers" : "suppliers";
  const { error } = await supabase.from(partyTable).delete().eq("id", partyId);
  if (error) throw error;
}

/** يعدّ عمليات طرف معيّن (لعرض التحذير قبل الحذف المتسلسل). */
export async function countPartyOperations(partyType, partyId) {
  const isCustomer = partyType === "customer";
  const mainTable = isCustomer ? "sales" : "purchases";
  const idField = isCustomer ? "customer_id" : "supplier_id";
  const [{ count: mainCount }, { count: opsCount }, { count: payCount }] = await Promise.all([
    supabase.from(mainTable).select("id", { count: "exact", head: true }).eq(idField, partyId),
    supabase.from("custom_operations").select("id", { count: "exact", head: true }).eq("party_type", partyType).eq("party_id", partyId),
    supabase.from("payments").select("id", { count: "exact", head: true }).eq("party_type", partyType).eq("party_id", partyId),
  ]);
  return { main: mainCount || 0, custom: opsCount || 0, payments: payCount || 0, total: (mainCount || 0) + (opsCount || 0) + (payCount || 0) };
}

/** تحديث عملية موجودة (من صفحة المبيعات أو المشتريات). */
export async function updateSale(id, fields) {
  const { error } = await supabase.from("sales").update(fields).eq("id", id);
  if (error) throw error;
}
export async function updatePurchase(id, fields) {
  const { error } = await supabase.from("purchases").update(fields).eq("id", id);
  if (error) throw error;
}

/** حفظ عملية جديدة حسب نوعها (يستخدمها كل من شاشة المحادثة). typeRow من fetchOperationTypes. */
export async function saveOperationByType(typeRow, fields, lists) {
  const code = typeRow.code || "OP";
  const opNumber = `${code}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;

  if (typeRow.system_key === "sale") {
    if (!fields.party_name) throw new Error("اسم العميل مطلوب");
    const qty = num(fields.quantity);
    if (qty === null) throw new Error("الكمية مطلوبة");
    const price = num(fields.unit_price) ?? (num(fields.amount) / qty);
    if (price === null || isNaN(price)) throw new Error("السعر أو المبلغ مطلوب");
    const customer = await ensureParty("customer", fields.party_name);
    const product = await ensureProduct(fields.product_name || "ديزل");
    const location = findByName(lists.locations, fields.location_name);
    const gross = qty * price;
    const fees = num(fields.fees) || 0;
    const net = gross + fees;
    const paid = num(fields.paid) || 0;
    const { error } = await supabase.from("sales").insert({
      op_number: opNumber, date: fields.date, customer_id: customer.id, location_id: location?.id || null,
      product_id: product?.id || null, quantity: qty, unit_price: price, gross_total: gross, fees, net_total: net,
      paid, remaining: net - paid, invoice_number: fields.invoice_number || null, notes: fields.notes || null,
    });
    if (error) throw error;
  } else if (typeRow.system_key === "purchase") {
    if (!fields.party_name) throw new Error("اسم المورد مطلوب");
    const qty = num(fields.quantity);
    const price = num(fields.unit_price);
    const amount = num(fields.amount) ?? (qty && price ? qty * price : null);
    if (amount === null) throw new Error("المبلغ أو (الكمية + السعر) مطلوب");
    const supplier = await ensureParty("supplier", fields.party_name);
    const product = await ensureProduct(fields.product_name || "ديزل");
    const paid = num(fields.paid) || 0;
    const { error } = await supabase.from("purchases").insert({
      op_number: opNumber, date: fields.date, supplier_id: supplier.id,
      description: fields.notes || `شراء ${fields.product_name || ""}`.trim(), product_id: product?.id || null,
      quantity: qty, unit_price: price, amount, paid, running_balance: amount - paid,
      invoice_number: fields.invoice_number || null, notes: fields.notes || null,
    });
    if (error) throw error;
  } else if (typeRow.system_key === "customer_payment" || typeRow.system_key === "supplier_payment") {
    if (!fields.party_name) throw new Error("اسم الطرف مطلوب");
    const amount = num(fields.amount);
    if (amount === null) throw new Error("المبلغ مطلوب");
    const isCustomer = typeRow.system_key === "customer_payment";
    const party = await ensureParty(isCustomer ? "customer" : "supplier", fields.party_name);
    const { error } = await supabase.from("payments").insert({
      op_number: opNumber, date: fields.date, party_type: isCustomer ? "customer" : "supplier",
      party_id: party.id, payment_type: isCustomer ? "تحصيل" : "سداد", amount, notes: fields.notes || null,
    });
    if (error) throw error;
  } else if (typeRow.system_key === "expense") {
    const amount = num(fields.amount);
    if (amount === null) throw new Error("المبلغ مطلوب");
    const { error } = await supabase.from("expenses").insert({
      date: fields.date, item_name: fields.notes || "مصروف", category: "مصروفات عامة", amount, notes: fields.notes || null,
    });
    if (error) throw error;
  } else {
    // نوع مخصص (مرتجع، تعبئة لزبون، أو أي نوع آخر أضافه المستخدم)
    if (!fields.party_name) throw new Error("اسم الطرف مطلوب");
    const amount = num(fields.amount);
    if (amount === null) throw new Error("المبلغ مطلوب");
    const partyType = fields.party_type || "customer";
    const party = await ensureParty(partyType, fields.party_name);
    const effect = fields.effect === -1 ? -1 : 1;
    const { error } = await supabase.from("custom_operations").insert({
      op_number: opNumber, date: fields.date, type_name: typeRow.name, party_type: partyType,
      party_id: party.id, effect, amount, description: fields.notes || null, reference_number: fields.reference_number || null,
    });
    if (error) throw error;
  }
  return opNumber;
}
