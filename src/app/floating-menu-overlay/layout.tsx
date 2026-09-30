export const metadata = {
  title: "القائمة الدائرية العائمة",
};

export default function FloatingOverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" style={{ background: "transparent", backgroundColor: "transparent" }}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: `
          html, body {
            background: transparent !important;
            background-color: transparent !important;
            margin: 0;
            padding: 0;
            overflow: hidden;
            user-select: none;
          }
        `}} />
      </head>
      <body style={{ background: "transparent", backgroundColor: "transparent" }}>
        {children}
      </body>
    </html>
  );
}
