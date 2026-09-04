"use client";
import React, { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { COLORS } from "../../../lib/theme";

export default function AccountSettingsPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data?.user?.email || "");
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: COLORS.gold, marginBottom: 16 }}>إعدادات الحساب</h1>
      <div style={{ background: COLORS.panel, borderRadius: 14, padding: 18, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 6 }}>البريد الإلكتروني</div>
        <div style={{ fontSize: 15, color: COLORS.text, fontWeight: 700 }}>{loading ? "جاري التحميل…" : email}</div>
      </div>
      <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 14, textAlign: "center" }}>
        المزيد من إعدادات الحساب (تغيير كلمة المرور، إلخ) ستُضاف هنا لاحقًا.
      </div>
    </div>
  );
}
