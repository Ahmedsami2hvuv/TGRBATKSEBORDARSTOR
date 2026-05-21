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

  // التوجه للمتجر مباشرة بدلاً من واجهة الإدارة
  redirect("/store");
}
