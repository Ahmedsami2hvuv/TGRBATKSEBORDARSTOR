import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ClientRuntime } from "@/components/client-runtime";
import { getRoleFeatures } from "@/lib/role-features-settings";
import { prisma } from "@/lib/prisma";
import "./globals.css";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mandoubFeatures, preparerFeatures, storeSettings] = await Promise.all([
    getRoleFeatures("mandoub"),
    getRoleFeatures("preparer"),
    prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "customer", section: "store_general" } }
    })
  ]);

  const storeFeatures = {
    aiEnabled: (storeSettings?.config as any)?.ai_enabled !== false
  };

  return (
    <html
      lang="ar"
      dir="rtl"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <ClientRuntime
            mandoubFeatures={mandoubFeatures}
            preparerFeatures={preparerFeatures}
            storeFeatures={storeFeatures}
          >
            {children}
          </ClientRuntime>
        </ThemeProvider>
      </body>
    </html>
  );
}
