"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { COLORS } from "../../lib/theme";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: COLORS.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380, background: COLORS.panel, borderRadius: 18, padding: 28, border: `1px solid ${COLORS.border}` }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: COLORS.gold }}>مسارات أزل</div>
          <div style={{ fontSize: 12, color: COLORS.textDim }}>Masarat Azal — تسجيل الدخول</div>
        </div>

        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>البريد الإلكتروني</div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "block", marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: COLORS.textDim, marginBottom: 5, fontWeight: 600 }}>كلمة المرور</div>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </label>

          {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: COLORS.gold,
              color: COLORS.bg,
              border: "none",
              borderRadius: 12,
              padding: "13px",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "جاري…" : mode === "login" ? "دخول" : "إنشاء حساب"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: COLORS.textDim }}>
          {mode === "login" ? (
            <>
              أول مرة؟{" "}
              <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: COLORS.gold, fontWeight: 700, cursor: "pointer" }}>
                أنشئ حسابًا
              </button>
            </>
          ) : (
            <>
              لديك حساب؟{" "}
              <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: COLORS.gold, fontWeight: 700, cursor: "pointer" }}>
                دخول
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: `1.5px solid ${COLORS.border}`,
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
  background: COLORS.panelLight,
  color: COLORS.text,
};
