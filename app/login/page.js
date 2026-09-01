"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { COLORS } from "../../lib/theme";

export default function LoginPage() {
  if (typeof window !== "undefined") {
    document.title = "URL=" + process.env.NEXT_PUBLIC_SUPABASE_URL + " | KEY=" + (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").slice(0, 15);
  }

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
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 18, padding: 28, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: COLORS.green }}>مسارات أزل</div>
          <div style={{ fontSize: 12, color: COLORS.grey }}>Masarat Azal — تسجيل الدخول</div>
        </div>

        <form onSubmit={submit}>
          <label style={{ display: "block", marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 5, fontWeight: 600 }}>البريد الإلكتروني</div>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "block", marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: COLORS.grey, marginBottom: 5, fontWeight: 600 }}>كلمة المرور</div>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
          </label>

          {error && <div style={{ color: COLORS.red, fontSize: 13, marginBottom: 14 }}>⚠️ {error}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: COLORS.green,
              color: "#fff",
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

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: COLORS.grey }}>
          {mode === "login" ? (
            <>
              أول مرة؟{" "}
              <button onClick={() => setMode("signup")} style={{ background: "none", border: "none", color: COLORS.green, fontWeight: 700, cursor: "pointer" }}>
                أنشئ حسابًا
              </button>
            </>
          ) : (
            <>
              لديك حساب؟{" "}
              <button onClick={() => setMode("login")} style={{ background: "none", border: "none", color: COLORS.green, fontWeight: 700, cursor: "pointer" }}>
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
  border: `1.5px solid ${COLORS.silver}`,
  fontSize: 15,
  boxSizing: "border-box",
  outline: "none",
};
