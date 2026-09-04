"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS } from "../../../lib/theme";
import {
  fetchLists,
  ensureParty,
  fetchOperationTypes,
  addOperationType,
  updateOperationType,
} from "../../../lib/dataHelpers";

/**
 * إصلاح النصوص العربية التي تظهر بهذا الشكل:
 * Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª
 *
 * إذا كانت البيانات القادمة من قاعدة البيانات محفوظة بترميز خاطئ،
 * هذه الدالة تحاول إرجاعها إلى العربية الصحيحة.
 */
function fixMojibake(value) {
  if (value === null || value === undefined) return value;
  if (typeof value !== "string") return value;

  const badChars = /[ÃÂØÙÐÑ�]/;

  if (!badChars.test(value)) {
    return value;
  }

  try {
    let result = value;

    // نحاول الإصلاح أكثر من مرة في حالة وجود Double Encoding
    for (let i = 0; i < 3; i++) {
      if (!badChars.test(result)) break;

      const bytes = Uint8Array.from(
        result,
        (char) => char.charCodeAt(0) & 0xff
      );

      const decoded = new TextDecoder("utf-8", {
        fatal: false,
      }).decode(bytes);

      if (decoded === result) break;

      result = decoded;
    }

    return result;
  } catch {
    return value;
  }
}

/**
 * تنظيف بيانات القوائم القادمة من Supabase
 */
function cleanLists(data) {
  return {
    customers: (data?.customers || []).map((item) => ({
      ...item,
      name: fixMojibake(item.name),
    })),

    suppliers: (data?.suppliers || []).map((item) => ({
      ...item,
      name: fixMojibake(item.name),
    })),

    products: (data?.products || []).map((item) => ({
      ...item,
      name: fixMojibake(item.name),
    })),

    locations: (data?.locations || []).map((item) => ({
      ...item,
      name: fixMojibake(item.name),
      keywords: Array.isArray(item.keywords)
        ? item.keywords.map((keyword) => fixMojibake(keyword))
        : [],
    })),
  };
}

/**
 * تنظيف أنواع العمليات
 */
function cleanOperationTypes(data) {
  return (data || []).map((item) => ({
    ...item,
    name: fixMojibake(item.name),
    code: fixMojibake(item.code),
  }));
}

export default function SettingsPage() {
  const [lists, setLists] = useState({
    customers: [],
    suppliers: [],
    products: [],
    locations: [],
  });

  const [opTypes, setOpTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProduct, setNewProduct] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  const [newOpName, setNewOpName] = useState("");
  const [newOpCode, setNewOpCode] = useState("");

  const [editingType, setEditingType] = useState(null);

  const [obParty, setObParty] = useState("");
  const [obType, setObType] = useState("customer");
  const [obAmount, setObAmount] = useState("");
  const [obMsg, setObMsg] = useState("");

  async function load() {
    try {
      setLoading(true);

      const [l, ops] = await Promise.all([
        fetchLists(),
        fetchOperationTypes(),
      ]);

      setLists(cleanLists(l));
      setOpTypes(cleanOperationTypes(ops));
    } catch (error) {
      console.error("Settings load error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addProduct() {
    const name = newProduct.trim();

    if (!name) return;

    const { error } = await supabase.from("products").insert({
      name,
      behavior: "qty_price",
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewProduct("");
    await load();
  }

  async function addLocation() {
    const name = newLocation.trim();

    if (!name) return;

    const keywords = newKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const { error } = await supabase.from("locations").insert({
      name,
      keywords,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewLocation("");
    setNewKeywords("");

    await load();
  }

  async function saveOpeningBalance() {
    if (!obParty.trim() || !obAmount) return;

    setObMsg("");

    try {
      const party = await ensureParty(
        obType,
        obParty.trim()
      );

      const { error } = await supabase
        .from("opening_balances")
        .insert({
          party_type: obType,
          party_id: party.id,
          amount: Number(obAmount),
        });

      if (error) {
        throw error;
      }

      setObMsg("تم الحفظ بنجاح");
      setObParty("");
      setObAmount("");

      await load();
    } catch (e) {
      setObMsg("⚠️ " + (e?.message || "حدث خطأ"));
    }
  }

  async function addOpType() {
    const name = newOpName.trim();
    const code = newOpCode.trim().toUpperCase();

    if (!name || !code) return;

    try {
      await addOperationType(name, code);

      setNewOpName("");
      setNewOpCode("");

      await load();
    } catch (e) {
      alert(e?.message || "حدث خطأ أثناء الإضافة");
    }
  }

  async function saveEdit() {
    if (!editingType) return;

    const name = editingType.name.trim();
    const code = editingType.code.trim().toUpperCase();

    if (!name || !code) return;

    try {
      await updateOperationType(editingType.id, {
        name,
        code,
      });

      setEditingType(null);

      await load();
    } catch (e) {
      alert(e?.message || "حدث خطأ أثناء الحفظ");
    }
  }

  if (loading) {
    return (
      <div
        dir="rtl"
        style={{
          minHeight: "100%",
          color: COLORS.text,
          padding: 20,
          textAlign: "center",
        }}
      >
        جاري تحميل الإعدادات...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        width: "100%",
        direction: "rtl",
        textAlign: "right",
      }}
    >
      {/* العنوان */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: COLORS.gold,
          marginBottom: 16,
          direction: "rtl",
        }}
      >
        {"\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"}
      </h1>

      {/* أنواع العمليات */}
      <Section
        title={
          "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0623\u0633\u0627\u0633\u064a\u0629 \u0648\u0627\u0644\u0645\u062e\u0635\u0635\u0629"
        }
      >
        <div
          style={{
            fontSize: 12,
            color: COLORS.textDim,
            marginBottom: 10,
            lineHeight: 1.7,
          }}
        >
          {"\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0631\u0645\u0632 \u0642\u0627\u0628\u0644\u0627\u0646 \u0644\u0644\u062a\u0639\u062f\u064a\u0644. \u0627\u0644\u0631\u0645\u0632 \u064a\u064f\u0633\u062a\u062e\u062f\u0645 \u0641\u064a \u0628\u062f\u0627\u064a\u0629 \u0631\u0642\u0645 \u0627\u0644\u0639\u0645\u0644\u064a\u0629."}
        </div>

        {opTypes.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "9px 10px",
              background: COLORS.panelLight,
              borderRadius: 8,
              marginBottom: 6,
              direction: "rtl",
            }}
          >
            {editingType?.id === t.id ? (
              <>
                <input
                  value={editingType.name}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      name: e.target.value,
                    })
                  }
                  style={{
                    ...inputStyle,
                    marginBottom: 0,
                    flex: 1,
                  }}
                />

                <input
                  value={editingType.code}
                  onChange={(e) =>
                    setEditingType({
                      ...editingType,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  style={{
                    ...inputStyle,
                    marginBottom: 0,
                    width: 70,
                    marginRight: 6,
                    textAlign: "center",
                    direction: "ltr",
                  }}
                />

                <button
                  onClick={saveEdit}
                  style={{
                    ...btnStyle,
                    marginRight: 6,
                  }}
                >
                  {"\u062d\u0641\u0638"}
                </button>
              </>
            ) : (
              <>
                <span
                  style={{
                    color: COLORS.text,
                    fontSize: 13,
                    flex: 1,
                  }}
                >
                  {fixMojibake(t.name)}

                  {t.system_key ? (
                    <small
                      style={{
                        color: COLORS.textDim,
                        marginRight: 6,
                      }}
                    >
                      {"(\u0623\u0633\u0627\u0633\u064a)"}
                    </small>
                  ) : null}
                </span>

                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      color: COLORS.gold,
                      fontWeight: 700,
                      fontSize: 12,
                      direction: "ltr",
                    }}
                  >
                    {fixMojibake(t.code)}
                  </span>

                  <button
                    onClick={() =>
                      setEditingType({
                        ...t,
                        name: fixMojibake(t.name),
                        code: fixMojibake(t.code),
                      })
                    }
                    style={editButtonStyle}
                  >
                    {"\u062a\u0639\u062f\u064a\u0644"}
                  </button>
                </span>
              </>
            )}
          </div>
        ))}

        {/* إضافة نوع عملية */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
            alignItems: "center",
          }}
        >
          <input
            value={newOpName}
            onChange={(e) => setNewOpName(e.target.value)}
            placeholder={
              "\u0627\u0633\u0645 \u0646\u0648\u0639 \u0639\u0645\u0644\u064a\u0629 \u062c\u062f\u064a\u062f"
            }
            style={{
              ...inputStyle,
              marginBottom: 0,
              flex: 2,
            }}
          />

          <input
            value={newOpCode}
            onChange={(e) => setNewOpCode(e.target.value)}
            placeholder={"\u0627\u0644\u0631\u0645\u0632"}
            style={{
              ...inputStyle,
              marginBottom: 0,
              flex: 1,
              textAlign: "center",
              direction: "ltr",
            }}
          />

          <button
            onClick={addOpType}
            style={btnStyle}
          >
            {"\u0625\u0636\u0627\u0641\u0629"}
          </button>
        </div>
      </Section>

      {/* الأصناف */}
      <Section title={"\u0627\u0644\u0623\u0635\u0646\u0627\u0641"}>
        <div style={{ direction: "rtl" }}>
          {lists.products.map((p) => (
            <Chip key={p.id}>
              {fixMojibake(p.name)}
            </Chip>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 10,
          }}
        >
          <input
            value={newProduct}
            onChange={(e) => setNewProduct(e.target.value)}
            placeholder={"\u0635\u0646\u0641 \u062c\u062f\u064a\u062f"}
            style={{
              ...inputStyle,
              marginBottom: 0,
            }}
          />

          <button
            onClick={addProduct}
            style={btnStyle}
          >
            {"\u0625\u0636\u0627\u0641\u0629"}
          </button>
        </div>
      </Section>

      {/* المواقع */}
      <Section
        title={
          "\u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0648\u0627\u0644\u0643\u0644\u0645\u0627\u062a \u0627\u0644\u0645\u0641\u062a\u0627\u062d\u064a\u0629"
        }
      >
        {lists.locations.map((l) => (
          <div
            key={l.id}
            style={{
              fontSize: 13,
              marginBottom: 8,
              color: COLORS.text,
              lineHeight: 1.7,
            }}
          >
            <b>{fixMojibake(l.name)}</b>

            {l.keywords?.length ? (
              <span style={{ color: COLORS.textDim }}>
                {" — "}
                {l.keywords
                  .map((keyword) => fixMojibake(keyword))
                  .join("، ")}
              </span>
            ) : null}
          </div>
        ))}

        <input
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
          placeholder={"\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0642\u0639"}
          style={inputStyle}
        />

        <input
          value={newKeywords}
          onChange={(e) => setNewKeywords(e.target.value)}
          placeholder={
            "\u0643\u0644\u0645\u0627\u062a \u0645\u0641\u062a\u0627\u062d\u064a\u0629 \u0645\u0641\u0635\u0648\u0644\u0629 \u0628\u0641\u0627\u0635\u0644\u0629"
          }
          style={inputStyle}
        />

        <button
          onClick={addLocation}
          style={{
            ...btnStyle,
            width: "100%",
            height: 42,
          }}
        >
          {"\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0642\u0639"}
        </button>
      </Section>

      {/* الرصيد الافتتاحي */}
      <Section title={"\u0631\u0635\u064a\u062f \u0627\u0641\u062a\u062a\u0627\u062d\u064a"}>
        <div
          style={{
            fontSize: 12,
            color: COLORS.textDim,
            marginBottom: 8,
            lineHeight: 1.7,
          }}
        >
          {
            "\u0623\u062f\u062e\u0644 \u0642\u064a\u0645\u0629 \u0633\u0627\u0644\u0628\u0629 \u0625\u0646 \u0643\u0627\u0646 \u0627\u0644\u0631\u0635\u064a\u062f \u0645\u0633\u062a\u062d\u0642\u064b\u0627 \u0639\u0644\u064a\u0643."
          }
        </div>

        <select
          value={obType}
          onChange={(e) => setObType(e.target.value)}
          style={inputStyle}
        >
          <option value="customer">
            {"\u0639\u0645\u064a\u0644"}
          </option>

          <option value="supplier">
            {"\u0645\u0648\u0631\u062f"}
          </option>
        </select>

        <input
          value={obParty}
          onChange={(e) => setObParty(e.target.value)}
          placeholder={"\u0627\u0633\u0645 \u0627\u0644\u0637\u0631\u0641"}
          style={inputStyle}
        />

        <input
          value={obAmount}
          onChange={(e) => setObAmount(e.target.value)}
          placeholder={"\u0627\u0644\u0645\u0628\u0644\u063a"}
          type="number"
          style={{
            ...inputStyle,
            direction: "ltr",
            textAlign: "right",
          }}
        />

        {obMsg && (
          <div
            style={{
              fontSize: 13,
              marginBottom: 8,
              color: COLORS.text,
            }}
          >
            {obMsg}
          </div>
        )}

        <button
          onClick={saveOpeningBalance}
          style={{
            ...btnStyle,
            width: "100%",
            height: 42,
          }}
        >
          {"\u062d\u0641\u0638 \u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0627\u0641\u062a\u062a\u0627\u062d\u064a"}
        </button>
      </Section>
    </div>
  );
}

/* =========================
   المكونات المساعدة
========================= */

function Section({ title, children }) {
  return (
    <div
      dir="rtl"
      style={{
        background: COLORS.panel,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        border: `1px solid ${COLORS.border}`,
        direction: "rtl",
        textAlign: "right",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 14,
          color: COLORS.gold,
          marginBottom: 10,
          lineHeight: 1.6,
        }}
      >
        {title}
      </div>

      {children}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: COLORS.panelLight,
        color: COLORS.text,
        borderRadius: 20,
        padding: "5px 12px",
        fontSize: 12,
        marginLeft: 6,
        marginBottom: 6,
        direction: "rtl",
      }}
    >
      {children}
    </span>
  );
}

/* =========================
   التنسيقات
========================= */

const inputStyle = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: `1.5px solid ${COLORS.border}`,
  marginBottom: 8,
  boxSizing: "border-box",
  fontSize: 14,
  background: COLORS.panelLight,
  color: COLORS.text,
  direction: "rtl",
  textAlign: "right",
  outline: "none",
};

const btnStyle = {
  background: COLORS.gold,
  color: COLORS.bg,
  border: "none",
  borderRadius: 8,
  padding: "0 16px",
  height: 38,
  fontWeight: 700,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const editButtonStyle = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  borderRadius: 6,
  padding: "4px 9px",
  fontSize: 11,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
