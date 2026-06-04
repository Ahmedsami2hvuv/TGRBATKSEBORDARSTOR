import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

function parseCookies(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, entry) => {
      const [name, ...rest] = entry.split("=");
      if (!name) return acc;
      acc[name] = decodeURIComponent(rest.join("=") || "");
      return acc;
    }, {});
}

function getCookieHeader(): string | undefined {
  try {
    const hdr = headers();
    if (hdr && typeof (hdr as any).get === "function") {
      return (hdr as any).get("cookie");
    }
    if (hdr && typeof (hdr as any).cookie === "string") {
      return (hdr as any).cookie;
    }
  } catch {
    // ignore
  }
  return undefined;
}

function getCookieValue(name: string): string | undefined {
  try {
    const cookieStore = cookies();
    if (cookieStore && typeof (cookieStore as any).get === "function") {
      const cookie = (cookieStore as any).get(name);
      if (cookie && typeof cookie.value === "string") {
        return cookie.value;
      }
    }
  } catch {
    // ignore
  }

  const header = getCookieHeader();
  if (!header) return undefined;
  const parsed = parseCookies(header);
  return parsed[name];
}

export default function Home() {
  const mandoubC = getCookieValue("mandoub_c");
  const mandoubS = getCookieValue("mandoub_s");
  const mandoubExp = getCookieValue("mandoub_exp");
  const preparerP = getCookieValue("preparer_p");
  const preparerS = getCookieValue("preparer_s");
  const preparerExp = getCookieValue("preparer_exp");

  if (mandoubC && mandoubS && mandoubExp) {
    redirect(`/mandoub?c=${encodeURIComponent(mandoubC)}&s=${encodeURIComponent(mandoubS)}&exp=${encodeURIComponent(mandoubExp)}`);
  }

  if (preparerP && preparerS && preparerExp) {
    redirect(`/preparer?p=${encodeURIComponent(preparerP)}&s=${encodeURIComponent(preparerS)}&exp=${encodeURIComponent(preparerExp)}`);
  }

  // بدلاً من التوجيه السيرفري الفوري الذي قد يسبب انقطاع التحميل أو استبدال الرابط المحفوظ
  // سنعرض صفحة تحميل بتصميم بريميوم متحرك تقوم بالتوجيه الذكي على الكلاينت بناءً على الذاكرة المحلية
  return (
    <div dir="rtl" lang="ar" className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white font-sans select-none">
      <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative flex items-center justify-center">
          {/* خلفية الشعار المضيئة */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-sky-500/30 animate-pulse">
            <span className="text-4xl">⚡</span>
          </div>
          {/* حلقة التحميل الخارجية */}
          <div className="absolute -inset-2 rounded-[2rem] border-4 border-sky-500/10 border-t-sky-400 animate-spin" style={{ animationDuration: '1.2s' }} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-black text-slate-100 tracking-tight">أبو الأكبر للتوصيل</h1>
          <p className="text-sm font-bold text-slate-400">جاري تهيئة وتوجيه بوابتك الخاصة...</p>
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const STORAGE_KEY = "ksebordarstor:last-pwa-path";
                const storedRoute = localStorage.getItem(STORAGE_KEY);
                // إذا كان هناك رابط محفوظ للبوابة، نوجه المستخدم إليه فوراً
                if (storedRoute && storedRoute !== "/" && storedRoute !== window.location.pathname) {
                  window.location.replace(storedRoute);
                } else {
                  // التوجه الافتراضي للمتجر
                  window.location.replace("/store");
                }
              } catch (e) {
                window.location.replace("/store");
              }
            })();
          `,
        }}
      />
    </div>
  );
}
