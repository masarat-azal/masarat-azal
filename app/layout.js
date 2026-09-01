import "./globals.css";

export const metadata = {
  title: "مسارات أزل — Masarat Azal",
  description: "النظام المحاسبي والإداري لشركة مسارات أزل للنقليات",
};

export default function RootLayout({ children }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "غير موجود";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "غير موجود";
  const gem = process.env.GEMINI_API_KEY ? "موجود" : "غير موجود";

  return (
    <html lang="ar" dir="rtl">
      <body>
        <div style={{ padding: 16, fontFamily: "monospace", direction: "ltr", textAlign: "left", background: "#000", color: "#0f0", fontSize: 13 }}>
          <div>SUPABASE_URL = {url}</div>
          <div>ANON_KEY (أول 25 حرف) = {key.slice(0, 25)}</div>
          <div>ANON_KEY (الطول الكلي) = {key.length}</div>
          <div>GEMINI_API_KEY = {gem}</div>
        </div>
        {children}
      </body>
    </html>
  );
}
