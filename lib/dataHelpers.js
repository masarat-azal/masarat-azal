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

export async function getCustomerBalance(customerId) {
  const [{ data: sales }, { data: payments }, { data: openBal }] = await Promise.all([
    supabase.from("sales").select("net_total,paid").eq("customer_id", customerId),
    supabase.from("payments").select("amount").eq("party_type", "customer").eq("party_id", customerId),
    supabase.from("opening_balances").select("amount").eq("party_type", "customer").eq("party_id", customerId),
  ]);
  const totalNet = (sales || []).reduce((s, r) => s + (Number(r.net_total) || 0), 0);
  const paidInSales = (sales || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const totalPayments = (payments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const opening = (openBal || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balance = totalNet + opening - paidInSales - totalPayments;
  return { totalNet, paidInSales, totalPayments, opening, balance };
}

export async function getSupplierBalance(supplierId) {
  const { data: purchases } = await supabase
    .from("purchases")
    .select("amount,paid")
    .eq("supplier_id", supplierId);
  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("party_type", "supplier")
    .eq("party_id", supplierId);
  const { data: openBal } = await supabase
    .from("opening_balances")
    .select("amount")
    .eq("party_type", "supplier")
    .eq("party_id", supplierId);

  const totalAmount = (purchases || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const paidInPurchases = (purchases || []).reduce((s, r) => s + (Number(r.paid) || 0), 0);
  const totalPayments = (payments || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const opening = (openBal || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balance = totalAmount + opening - paidInPurchases - totalPayments;
  return { totalAmount, paidInPurchases, totalPayments, opening, balance };
}

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
