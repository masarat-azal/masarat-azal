"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS } from "../../../lib/theme";
import { getCustomerBalance, balanceDirection } from "../../../lib/dataHelpers";
import { money } from "../../../lib/theme";

export default function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  async function load() {
    setLoading(true);
    const { data: customers } = await supabase.from("customers").select("*").order("name");
    const withBalance = await Promise.all(
      (customers || []).map(async (c) => {
        const b = await getCustomerBalance(c.id);
        return { ...c, ...balanceDirection(false, b.balance) };
      })
    );
    setRows(withBalance);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCustomer() {
    if (!newName.trim()) return;
    await supabase.from("customers").insert({ name: newName.trim() });
    setNewName("");
    setShowAdd(false);
    load();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.green }}>العملاء</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}
        >
          + إضافة
        </button>
      </div>

      {showAdd && (
        <div style={{ background: "#fff", padding: 14, borderRadius: 12, marginBottom: 14, border: `1px solid ${COLORS.silver}`, display: "flex", gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم العميل الجديد"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: `1.5px solid ${COLORS.silver}` }}
          />
          <button onClick={addCustomer} style={{ background: COLORS.green, color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontWeight: 700 }}>
            حفظ
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: COLORS.grey }}>جاري التحميل…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: COLORS.grey }}>لا يوجد عملاء بعد.</div>
      ) : (
        rows.map((c) => (
          <a
            key={c.id}
            href={`/customers/${c.id}`}
            style={{
              display: "block",
              background: "#fff",
              borderRadius: 12,
              padding: 14,
              marginBottom: 10,
              border: `1px solid ${COLORS.silver}`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
            <div style={{ fontSize: 13, color: COLORS.grey, marginTop: 4 }}>
              {c.icon} {c.text}
              {c.amount ? `: ${money(c.amount)}` : ""}
            </div>
          </a>
        ))
      )}
    </div>
  );
}
