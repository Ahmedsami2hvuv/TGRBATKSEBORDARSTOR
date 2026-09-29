import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: "connected",
    site: "aboakbr.com - أبو الأكبر للتوصيل السريع",
    location: "أبو الخصيب - بصرة",
    message: "الربط ناجح 100% - هذا الشباك بين Vercel و تطبيق Meta",
    live: false,
    note: "بعد ما نتأكد من هذا الرابط، راح نربطه بـ Supabase"
  })
}
