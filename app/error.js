"use client";
export default function Error({ error }) {
  return (
    <div style={{ padding: 20, fontFamily: "monospace", direction: "ltr", textAlign: "left" }}>
      <h2>حدث خطأ فعلي — هذا نصه الكامل:</h2>
      <pre style={{ whiteSpace: "pre-wrap", color: "red", fontSize: 13 }}>
        {error?.message || "لا توجد رسالة"}
        {"\n\n"}
        {error?.stack || ""}
      </pre>
    </div>
  );
}
