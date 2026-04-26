import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from "jose";

const SECURITY_PARAMS = ['c', 'p', 'se', 's', 'exp'];
const ADMIN_COOKIE = "admin_token";

function getAdminSecret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // --- 1. حماية لوحة الإدارة (Admin Security) ---
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const secret = getAdminSecret();
    if (!secret) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    try {
      await jwtVerify(token, secret);
    } catch {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // --- 2. حماية روابط المندوب والمجهز (Clean URLs & Cookie Session) ---
  const hasSecurityParams = SECURITY_PARAMS.some(param => searchParams.has(param));

  if (hasSecurityParams) {
    const response = NextResponse.next();

    // حفظ بيانات المندوب
    if (searchParams.has('c')) {
      const c = searchParams.get('c')!;
      response.cookies.set('mandoub_c', c, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      if (searchParams.has('s') && pathname.startsWith('/mandoub')) {
        response.cookies.set('mandoub_s', searchParams.get('s')!, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      }
      if (searchParams.has('exp') && pathname.startsWith('/mandoub')) {
        response.cookies.set('mandoub_exp', searchParams.get('exp')!, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      }
    }

    // حفظ بيانات المجهز
    if (searchParams.has('p')) {
      const p = searchParams.get('p')!;
      response.cookies.set('preparer_p', p, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      if (searchParams.has('s') && pathname.startsWith('/preparer')) {
        response.cookies.set('preparer_s', searchParams.get('s')!, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      }
      if (searchParams.has('exp') && pathname.startsWith('/preparer')) {
        response.cookies.set('preparer_exp', searchParams.get('exp')!, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30 });
      }
    }

    // تنظيف الرابط وإعادة التوجيه
    const redirectUrl = new URL(request.url);
    SECURITY_PARAMS.forEach(p => redirectUrl.searchParams.delete(p));

    const finalResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach(cookie => {
      finalResponse.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30
      });
    });

    return finalResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/mandoub/:path*',
    '/preparer/:path*'
  ],
};
