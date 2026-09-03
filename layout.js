import "./globals.css";

export const metadata = {
  title: "مسارات أزل — Masarat Azal",
  description: "النظام المحاسبي والإداري لشركة مسارات أزل للنقليات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
