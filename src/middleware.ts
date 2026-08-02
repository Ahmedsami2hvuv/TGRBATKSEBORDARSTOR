import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECURITY_PARAMS = ["c", "p", "se", "s", "exp"];
const ADMIN_COOKIE = "admin_token";

// خريطة بسيطة في الذاكرة لتحديد معدل الطلبات (Rate Limiting)
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

function getAdminSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";

  // --- 1. الحماية الجغرافية (حظر الزيارات القادمة من خارج العراق) ---
  const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");
  const userAgent = request.headers.get("user-agent") || "";
  const isSearchEngine = /googlebot|bingbot|yandex|baiduspider|duckduckbot/i.test(userAgent);

  // إذا كانت الدولة معروفة وليست العراق (IQ) وليست من محركات البحث المعترف بها
  if (country && country !== "IQ" && !isSearchEngine && process.env.NODE_ENV === "production") {
    return new NextResponse(
      "<html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>المتجر متاح فقط داخل العراق / Store only available in Iraq</h2></body></html>",
      { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  // --- 2. تحديد معدل الطلبات (Rate Limiting لحظر الأدوات والبوتات) ---
  const now = Date.now();
  const windowMs = 60 * 1000; // نافذة زمنية دقيقة واحدة
  const maxRequests = 100; // الحد الأقصى 100 طلب في الدقيقة لكل IP

  const record = ipRequestCounts.get(ip);
  if (record) {
    if (now > record.resetTime) {
      ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
    } else {
      record.count++;
      if (record.count > maxRequests) {
        return new NextResponse(
          "<html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>تم حظر الطلبات المفرطة مؤقتاً لحماية المتجر</h2></body></html>",
          { status: 429, headers: { "content-type": "text/html; charset=utf-8" } }
        );
      }
    }
  } else {
    ipRequestCounts.set(ip, { count: 1, resetTime: now + windowMs });
  }

  // --- 3. حماية لوحة الإدارة (Admin Security) ---
  if (
    pathname.startsWith("/abo1stor3hlaa2kbr8-47") && 
    !pathname.startsWith("/abo1stor3hlaa2kbr8-47/login") &&
    !pathname.startsWith("/abo1stor3hlaa2kbr8-47/credit-book/login")
  ) {
    const secret = getAdminSecret();
    if (!secret) {
      return NextResponse.redirect(new URL("/abo1stor3hlaa2kbr8-47/login", request.url));
    }
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/abo1stor3hlaa2kbr8-47/login", request.url));
    }
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload && payload.isAccountant) {
        const isAllowedCreditBookPath = pathname === "/abo1stor3hlaa2kbr8-47/credit-book" || pathname.startsWith("/abo1stor3hlaa2kbr8-47/credit-book/");
        const isManageAccountants = pathname.startsWith("/abo1stor3hlaa2kbr8-47/credit-book/accountants");
        if (!isAllowedCreditBookPath || isManageAccountants) {
          return NextResponse.redirect(new URL("/abo1stor3hlaa2kbr8-47/credit-book", request.url));
        }
      }
    } catch {
      return NextResponse.redirect(new URL("/abo1stor3hlaa2kbr8-47/login", request.url));
    }
  }

  // --- 4. حماية روابط المندوب والمجهز (Clean URLs & Cookie Session) ---
  const hasSecurityParams = SECURITY_PARAMS.some((param) => searchParams.has(param));

  if (hasSecurityParams) {
    const response = NextResponse.next();

    // حفظ بيانات المندوب
    if (searchParams.has("c")) {
      const c = searchParams.get("c")!;
      response.cookies.set("mandoub_c", c, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      if (searchParams.has("s") && pathname.startsWith("/mandoub")) {
        response.cookies.set("mandoub_s", searchParams.get("s")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      }
      if (searchParams.has("exp") && pathname.startsWith("/mandoub")) {
        response.cookies.set("mandoub_exp", searchParams.get("exp")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      }
    }

    // حفظ بيانات المجهز
    if (searchParams.has("p")) {
      const p = searchParams.get("p")!;
      response.cookies.set("preparer_p", p, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      if (searchParams.has("s") && pathname.startsWith("/preparer")) {
        response.cookies.set("preparer_s", searchParams.get("s")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      }
      if (searchParams.has("exp") && pathname.startsWith("/preparer")) {
        response.cookies.set("preparer_exp", searchParams.get("exp")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      }
    }

    // تنظيف الرابط وإعادة التوجيه
    const redirectUrl = new URL(request.url);
    SECURITY_PARAMS.forEach((p) => redirectUrl.searchParams.delete(p));

    const finalResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    });

    return finalResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

