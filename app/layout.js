import "./globals.css";

export const metadata = {
  title: "مسارات أزل — Masarat Azal",
  description: "النظام المحاسبي والإداري لشركة مسارات أزل للنقليات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <div id="err-box" style={{ display: "none", padding: 16, fontFamily: "monospace", direction: "ltr", textAlign: "left", background: "#fee", color: "#900", fontSize: 12, whiteSpace: "pre-wrap" }}></div>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                var box = document.getElementById('err-box');
                if (box) { box.style.display = 'block'; box.textContent = 'ERROR: ' + e.message + '\\n' + (e.error && e.error.stack || ''); }
              });
              window.addEventListener('unhandledrejection', function(e) {
                var box = document.getElementById('err-box');
                if (box) { box.style.display = 'block'; box.textContent = 'PROMISE ERROR: ' + (e.reason && e.reason.message || e.reason); }
              });
            `,
          }}
        />
      </body>
    </html>
  );
}
