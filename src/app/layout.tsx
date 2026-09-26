import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientRuntime } from "@/components/client-runtime";
import { StaticBackground } from "@/components/static-background";
import { isChatEnabledGlobally, isTrackingEnabledGlobally } from "@/lib/portal-chat-settings";
import { getRoleFeatures } from "@/lib/role-features-settings";
import { getAvailableFonts, getChosenFont, getFontFileUrl } from "@/lib/font-settings";
import { getOrderCardsDesignerConfig } from "@/lib/order-card-customizer";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Script from "next/script";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "أبو الأكبر للتوصيل",
  description: "إدارة التوصيل والطلبات — لوحة الإدارة",
  manifest: "/site.webmanifest",
  icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  appleWebApp: { capable: true, title: "أبو الأكبر للتوصيل", statusBarStyle: "default" },
  // إصدار التصميم الفاخر المكيش لكروت الطلبات v2.5
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const mandoubId = cookieStore.get("mandoub_c")?.value;
  const preparerId = cookieStore.get("preparer_p")?.value;
  const employeeId = cookieStore.get("employee_e")?.value;
  const externalId = mandoubId || preparerId || employeeId;

  // استرجاع الميزات بشكل آمن جداً
  const [mandoubFeatures, preparerFeatures, chatEnabled, trackingEnabled, availableFonts, chosenFont, designerConfig] = await Promise.all([
    getRoleFeatures("mandoub").catch(() => ({})),
    getRoleFeatures("preparer").catch(() => ({})),
    isChatEnabledGlobally().catch(() => true),
    isTrackingEnabledGlobally().catch(() => true),
    Promise.resolve(getAvailableFonts()),
    getChosenFont(),
    getOrderCardsDesignerConfig().catch(() => null),
  ]);

  // استخراج روابط كافة الصور والأصول المخصصة للتكييش والتحميل المسبق بأمان تام
  const customAssetUrls: string[] = [];
  const isValidPreloadImg = (u: any): boolean => {
    if (typeof u !== "string") return false;
    const t = u.trim();
    if (!t || t.length < 4 || t.length > 500) return false;
    if (t.includes(" ") || t.includes('"') || t.includes("{") || t.includes("}")) return false;
    if (t.includes("maps.google") || t.includes("maps.app.goo.gl") || t.includes("goo.gl")) return false;
    return t.startsWith("/images/") || t.startsWith("/uploads/") || t.startsWith("/api/image/") || t.startsWith("https://");
  };

  if (designerConfig) {
    if (designerConfig.shopCard?.frameBgUrl && !designerConfig.shopCard.frameBgUrl.startsWith("/images/")) {
      if (isValidPreloadImg(designerConfig.shopCard.frameBgUrl)) customAssetUrls.push(designerConfig.shopCard.frameBgUrl.trim());
    }
    if (designerConfig.shopCard) {
      Object.values(designerConfig.shopCard).forEach((elem: any) => {
        if (elem?.imageUrl && isValidPreloadImg(elem.imageUrl)) customAssetUrls.push(elem.imageUrl.trim());
      });
    }
    if (designerConfig.customerCard?.frameBgUrl) {
      if (isValidPreloadImg(designerConfig.customerCard.frameBgUrl)) customAssetUrls.push(designerConfig.customerCard.frameBgUrl.trim());
    }
    if (designerConfig.customerCard) {
      Object.values(designerConfig.customerCard).forEach((elem: any) => {
        if (elem?.imageUrl && isValidPreloadImg(elem.imageUrl)) customAssetUrls.push(elem.imageUrl.trim());
      });
    }
    if (designerConfig.waButtonsConfig) {
      Object.values(designerConfig.waButtonsConfig).forEach((elem: any) => {
        if (elem?.imageUrl && isValidPreloadImg(elem.imageUrl)) customAssetUrls.push(elem.imageUrl.trim());
      });
    }
  }

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
        {/* التحميل المسبق والتكييش الدائم لكافة عناصر وأزرار كروت الطلبات الفاخرة لضمان فتح فوري دون وميض في الـ APK */}
        <link rel="preload" href="/images/order-luxury/order-card-frame-edge-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/order-number-bg.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/price-circle.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/customer-phone-pill.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/header-new-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/header-assigned-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/header-received-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/header-delivered-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/badge-sader.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/badge-ward.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/badge-preparer-sader.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/badge-preparer-ward.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-pickup-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-delivery-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-istilam.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-tasleem.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-assign-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-assign-empty-v2.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-open-location.webp?v=royalLocV2" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-no-location.webp?v=royalLocV2" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-edit.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-reject.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-restore.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/icon-reverse.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-reverse-order.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/1789252908710.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-chat.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/btn-door.webp?v=royal3D" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/modal-luxury-frame.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/shop-card-frame.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/header-shop-info.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/header-shop-photo.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/icon-shop-name.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/icon-customer-name.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/icon-region.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/icon-phone.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/btn-shop-location.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/placeholder-no-photo.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/btn-call.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/btn-whatsapp.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/btn-camera.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/shop-card/btn-gallery.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/ak-submit-btn-v3.webp" as="image" type="image/webp" />
        <link rel="preload" href="/images/order-luxury/ak-update-order-btn.webp" as="image" type="image/webp" />

        {/* التحميل المسبق الديناميكي لأي أصول وصور مخصصة من استوديو التصميم */}
        {customAssetUrls.map((url, idx) => (
          <link key={`custom-asset-${idx}`} rel="preload" href={url} as="image" type="image/webp" />
        ))}

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var luxuryImages = [
                    '/images/order-luxury/order-card-frame.webp',
                    '/images/order-luxury/order-number-bg.webp',
                    '/images/order-luxury/price-circle.webp',
                    '/images/order-luxury/customer-phone-pill.webp',
                    '/images/order-luxury/header-new.webp',
                    '/images/order-luxury/header-assigned.webp',
                    '/images/order-luxury/header-received.webp',
                    '/images/order-luxury/header-delivered.webp',
                    '/images/order-luxury/badge-sader.webp',
                    '/images/order-luxury/badge-ward.webp',
                    '/images/order-luxury/badge-preparer-sader.webp',
                    '/images/order-luxury/badge-preparer-ward.webp',
                    '/images/order-luxury/btn-pickup.webp',
                    '/images/order-luxury/btn-delivery.webp',
                    '/images/order-luxury/btn-istilam.webp',
                    '/images/order-luxury/btn-tasleem.webp',
                    '/images/order-luxury/btn-assign.webp',
                    '/images/order-luxury/btn-assign-empty.webp',
                    '/images/order-luxury/btn-open-location.webp?v=royalLocV2',
                    '/images/order-luxury/btn-no-location.webp?v=royalLocV2',
                    '/images/order-luxury/btn-edit.webp?v=royal3D',
                    '/images/order-luxury/btn-reject.webp?v=royal3D',
                    '/images/order-luxury/btn-restore.webp?v=royal3D',
                    '/images/order-luxury/icon-reverse.webp',
                    '/images/order-luxury/1789252908710.webp?v=royal3D',
                    '/images/order-luxury/btn-chat.webp?v=royal3D',
                    '/images/order-luxury/btn-door.webp?v=royal3D',
                    '/images/order-luxury/modal-luxury-frame.webp',
                    '/images/order-luxury/shop-card/shop-card-frame.webp',
                    '/images/order-luxury/shop-card/header-shop-info.webp',
                    '/images/order-luxury/shop-card/header-shop-photo.webp',
                    '/images/order-luxury/shop-card/icon-shop-name.webp',
                    '/images/order-luxury/shop-card/icon-customer-name.webp',
                    '/images/order-luxury/shop-card/icon-region.webp',
                    '/images/order-luxury/shop-card/icon-phone.webp',
                    '/images/order-luxury/shop-card/btn-shop-location.webp',
                    '/images/order-luxury/shop-card/placeholder-no-photo.webp',
                    '/images/order-luxury/shop-card/btn-call.webp',
                    '/images/order-luxury/shop-card/btn-whatsapp.webp',
                    '/images/order-luxury/shop-card/btn-camera.webp',
                    '/images/order-luxury/shop-card/btn-gallery.webp'
                  ].concat(${JSON.stringify(customAssetUrls)});
                  luxuryImages.forEach(function(src) {
                    if (src && typeof src === 'string' && src.indexOf('maps.google') === -1 && src.indexOf('goo.gl') === -1 && src.indexOf('{') === -1 && src.indexOf('"') === -1) {
                      var img = new Image();
                      img.src = src;
                    }
                  });
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
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
