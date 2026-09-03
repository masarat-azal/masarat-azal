import { supabase } from "./supabaseClient";

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

export async function fetchOperationTypes() {
  const { data } = await supabase.from("operation_types").select("*").order("name");
  return data || [];
}

export async function addOperationType(name) {
  const { data, error } = await supabase.from("operation_types").insert({ name }).select().single();
  if (error) throw error;
  return data;
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

async function getCustomOpsEffect(partyType, partyId) {
  const { data } = await supabase
    .from("custom_operations")
    .select("effect,amount")
    .eq("party_type", partyType)
    .eq("party_id", partyId);
  return (data || []).reduce((s, r) => s + (Number(r.effect) || 1) * (Number(r.amount) || 0), 0);
}

export async function fetchCustomOperations(partyType, partyId) {
  const { data } = await supabase
    .from("custom_operations")
    .select("*")
    .eq("party_type", partyType)
    .eq("party_id", partyId)
    .order("date", { ascending: false });
  return data || [];
}

/** يجلب كل المستندات المرتبطة برقم عملية معيّن. */
export async function fetchDocumentsForOp(opNumber) {
  if (!opNumber) return [];
  const { data } = await supabase.from("documents").select("*").eq("op_number", opNumber);
  return data || [];
}

/** يجلب كل المستندات المرتبطة بمجموعة أرقام عمليات دفعة واحدة (لصفحة الطرف). */
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

/**
 * يضغط صورة في المتصفح (يصغّر الأبعاد ويقلل الجودة) لتفادي حد حجم الطلب في الخادم،
 * ثم يرفعها إلى Supabase Storage (حاوية "documents")، ويحفظ سجلًا في جدول documents.
 * يرجع الرابط العام للملف.
 */
export async function compressImage(file, maxWidth = 1600, quality = 0.75) {
  if (!file.type.startsWith("image/")) return file; // PDF أو غيره: يُرفع كما هو
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
          (blob) => {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
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

  const { error: upErr } = await supabase.storage.from("documents").upload(path, compressed, {
    contentType: compressed.type,
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("documents").getPublicUrl(path);
  const fileUrl = pub.publicUrl;

  const { error: dbErr } = await supabase.from("documents").insert({
    op_number: opNumber,
    doc_type: docType || compressed.type,
    file_url: fileUrl,
  });
  if (dbErr) throw dbErr;

  return fileUrl;
}

/** يحسب رصيد عميل: إجمالي المبيعات (صافي) + الرصيد الافتتاحي + أثر العمليات المخصصة - المدفوع. */
export async function getCustomerBalance(customerId) {
  const [{ data: sales }, { data: payments }, { data: openBal }, customOpsEffect] = await Promise.all([
    supabase.from("sales").select("net_total,paid").eq("customer_id", customerId),
    supabase.from("payments").select("amount").eq("party_type", "customer").eq("party_id", customerId),
    supabase.from("opening_balances").select("amount").eq("party_type", "customer").eq("party_id", customerId),
    getCustomOpsEffect("customer", customerId),
  ]);
  const totalNet = (sales || []).reduce((s, r) => s + (Number(r.net_total) || 0), 0);
  const paidInSales = (sales || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const totalPayments = (payments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const opening = (openBal || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balance = totalNet + opening + customOpsEffect - paidInSales - totalPayments;
  return { totalNet, paidInSales, totalPayments, opening, customOpsEffect, balance };
}

/** يحسب رصيد مورد، بما فيه أثر العمليات المخصصة. */
export async function getSupplierBalance(supplierId) {
  const [{ data: purchases }, { data: payments }, { data: openBal }, customOpsEffect] = await Promise.all([
    supabase.from("purchases").select("amount,paid").eq("supplier_id", supplierId),
    supabase.from("payments").select("amount").eq("party_type", "supplier").eq("party_id", supplierId),
    supabase.from("opening_balances").select("amount").eq("party_type", "supplier").eq("party_id", supplierId),
    getCustomOpsEffect("supplier", supplierId),
  ]);
  const totalAmount = (purchases || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const paidInPurchases = (purchases || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const totalPayments = (payments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const opening = (openBal || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balance = totalAmount + opening + customOpsEffect - paidInPurchases - totalPayments;
  return { totalAmount, paidInPurchases, totalPayments, opening, customOpsEffect, balance };
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
