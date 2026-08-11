import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientRuntime } from "@/components/client-runtime";
import { StaticBackground } from "@/components/static-background";
import { isChatEnabledGlobally, isTrackingEnabledGlobally } from "@/lib/portal-chat-settings";
import { getRoleFeatures } from "@/lib/role-features-settings";
import { getAvailableFonts, getChosenFont, getFontFileUrl } from "@/lib/font-settings";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "أبو الأكبر للتوصيل",
  description: "إدارة التوصيل والطلبات — لوحة الإدارة",
  manifest: "/site.webmanifest",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "أبو الأكبر للتوصيل", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0ea5e9" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const mandoubId = cookieStore.get("mandoub_c")?.value;
  const preparerId = cookieStore.get("preparer_p")?.value;
  const employeeId = cookieStore.get("employee_e")?.value;
  const externalId = mandoubId || preparerId || employeeId;

  // استرجاع الميزات بشكل آمن جداً
  const [mandoubFeatures, preparerFeatures, chatEnabled, trackingEnabled, availableFonts, chosenFont, defaultBg] = await Promise.all([
    getRoleFeatures("mandoub").catch(() => ({})),
    getRoleFeatures("preparer").catch(() => ({})),
    isChatEnabledGlobally().catch(() => true),
    isTrackingEnabledGlobally().catch(() => true),
    Promise.resolve(getAvailableFonts()),
    getChosenFont(),
    prisma.systemBackground.findFirst({ where: { active: true } }).catch(() => null),
  ]);

  const defaultBgUrl = defaultBg?.imageUrl || "";

  // توليد تعريفات الخطوط ديناميكياً
  const fontFaceCss = availableFonts.map(fontName => {
    const url = getFontFileUrl(fontName);
    if (!url) return "";
    const extension = url.split('.').pop()?.toLowerCase();
    let format = 'truetype';
    if (extension === 'woff') format = 'woff';
    if (extension === 'woff2') format = 'woff2';
    if (extension === 'otf') format = 'opentype';
    if (extension === 'eot') format = 'embedded-opentype';
    if (extension === 'svg') format = 'svg';
    if (extension === 'ttc') format = 'collection';

    return `
      @font-face {
        font-family: '${fontName}';
        src: url('${url}') format('${format}');
        font-weight: normal;
        font-style: normal;
        font-display: swap;
      }
    `;
  }).join("");

  const displayFont = chosenFont === "system-ui" ? "system-ui" : `'${chosenFont}'`;


  return (
    <html lang="ar" dir="rtl" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  document.documentElement.classList.remove('dark');
                } catch (e) {}
              })();
            `,
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: `
          ${fontFaceCss}
          :root {
            --chosen-font: ${displayFont}, Inter, system-ui, -apple-system, sans-serif;
          }
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <StaticBackground systemDefaultBgUrl={defaultBgUrl} />
          <ClientRuntime
            mandoubFeatures={mandoubFeatures}
            preparerFeatures={preparerFeatures}
            chatEnabled={chatEnabled}
            trackingEnabled={trackingEnabled}
            storeFeatures={{ aiEnabled: false }}
            externalId={externalId}
          >
            {children}
          </ClientRuntime>
        </ThemeProvider>
        {/* التحميل الخامل لمشغل الأنيميشن الثقيل Lottie لتفادي حظر المعالج الرئيسي في التحميل الأولي */}
        <Script
          src="https://unpkg.com/@lottiefiles/lottie-player@1.5.7/dist/lottie-player.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
