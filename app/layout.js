import "./globals.css";

export const metadata = {
  title: "مسارات أزل — Masarat Azal",
  description: "النظام المحاسبي والإداري لشركة مسارات أزل للنقليات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                alert('ERROR: ' + e.message);
              }, { once: true });
              window.addEventListener('unhandledrejection', function(e) {
                alert('PROMISE ERROR: ' + (e.reason && e.reason.message || e.reason));
              }, { once: true });
            `,
          }}
        />
      </body>
    </html>
  );
}
