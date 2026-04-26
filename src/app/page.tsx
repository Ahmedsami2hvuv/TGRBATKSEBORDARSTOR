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

  return (
    <div className="kse-app-bg flex min-h-screen flex-col">
      <div className="kse-app-inner flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="kse-glass-card max-w-lg p-10 text-center">
          <p className="text-sm font-bold text-sky-800">أبو الأكبر للتوصيل</p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            نظام إدارة التوصيل
          </h1>
          <p className="mt-4 text-sm text-slate-600">
            إذا كان لديك رابط خاص بالمندوب أو المجهز، يرجى فتحه من الرسالة مرة أخرى.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link
              href="/admin/login"
              className="inline-flex w-full justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-sky-200 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700"
            >
              دخول الإدارة
            </Link>
            <Link
              href="/register"
              className="inline-flex w-full justify-center rounded-xl border-2 border-sky-300 bg-white px-6 py-3 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
            >
              إنشاء حساب جديد
            </Link>
            <Link
              href="/forgot-password"
              className="inline-flex w-full justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
            >
              نسيت الرمز؟
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
