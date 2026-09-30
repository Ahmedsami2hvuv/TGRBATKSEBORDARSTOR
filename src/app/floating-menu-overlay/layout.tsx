export const metadata = {
  title: "القائمة الدائرية العائمة",
};

export default function FloatingOverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="bg-transparent">
      <body className="bg-transparent m-0 p-0 overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
