import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import dynamic from "next/dynamic";
import "./globals.css";

const EnterSubmitGlobal = dynamic(
  () => import("@/components/enter-submit-global").then((m) => m.EnterSubmitGlobal),
  { ssr: false },
);
const PwaServiceWorkerRegister = dynamic(
  () => import("@/components/pwa-service-worker-register").then((m) => m.PwaServiceWorkerRegister),
  { ssr: false },
);
const PwaRoutePreserver = dynamic(
  () => import("@/components/pwa-route-preserver").then((m) => m.PwaRoutePreserver),
  { ssr: false },
);
const GlobalAIAssistant = dynamic(() => import("@/components/GlobalAIAssistant"), { ssr: false });

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
