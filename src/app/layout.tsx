import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { EnterSubmitGlobal } from "@/components/enter-submit-global";
import { PwaServiceWorkerRegister } from "@/components/pwa-service-worker-register";
import { PwaRoutePreserver } from "@/components/pwa-route-preserver";
import { ThemeProvider } from "@/components/theme-provider";
import GlobalAIAssistant from "@/components/GlobalAIAssistant";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "أبو الأكبر للتوصيل",
  description: "إدارة التوصيل والطلبات — لوحة الإدارة",
  manifest: "/site.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "أبو الأكبر للتوصيل",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className={`${cairo.className} min-h-full flex flex-col`}>
        <ThemeProvider>
          <PwaServiceWorkerRegister />
          <PwaRoutePreserver />
          <EnterSubmitGlobal />
          {children}
          <GlobalAIAssistant />
        </ThemeProvider>
      </body>
    </html>
  );
}
