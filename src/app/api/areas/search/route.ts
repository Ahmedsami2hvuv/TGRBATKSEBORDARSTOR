import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// قائمة مناطق قضاء أبي الخصيب والبصرة الأكثر شهرة وتكراراً
const ABU_AL_KHASEEB_AREAS = [
  "نهر خوز",
  "نهر خوز طريزاوية",
  "ابو الخصيب مركز",
  "أبو الخصيب - السوق",
  "البلد",
  "محيلة",
  "باب طويل",
  "جيكور",
  "حمدان",
  "السراجي",
  "مهيجران",
  "الفياضي",
  "كوت الزين",
  "الدواسر",
  "باب ميدان",
  "الصنقير",
  "الشافي",
  "أبو مغيرة",
  "سيحان",
  "كوت الجوع",
  "السبيليات",
  "يوصل",
  "مناوي باشا",
  "الجزائر",
  "الطويسة",
  "العشار",
  "المعقل",
  "القبلة",
  "الجبيلة",
  "البراضعية"
]

// خوارزمية مسافة ليفنشتاين لمقارنة التشابه بين النصوص وتصحيح الأخطاء الإملائية
function levenshteinDistance(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix = Array.from({ length: bn + 1 }, () => new Array(an + 1).fill(0))

  for (let i = 0; i <= an; i++) matrix[0][i] = i
  for (let j = 0; j <= bn; j++) matrix[j][0] = j

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // حذف
        matrix[j - 1][i] + 1, // إدخال
        matrix[j - 1][i - 1] + cost // استبدال
      )
    }
  }

  return matrix[bn][an]
}

function normalizeArabic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // إزالة التشكيل
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q') || ""
  const cleanQ = normalizeArabic(query)

  if (!cleanQ) {
    return NextResponse.json({
      query: "",
      areas: ABU_AL_KHASEEB_AREAS.slice(0, 10),
      suggestions: []
    })
  }

  let dbAreas: { id: string; name: string }[] = []

  // 1. محاولة جلب المناطق من جدول Region في قاعدة البيانات
  try {
    const records = await prisma.region.findMany({
      select: { id: true, name: true },
      take: 50
    })
    dbAreas = records
  } catch (e) {
    // تجاهل الخطأ في حال تعذر الاتصال والاعتماد على القائمة المحلية
  }

  // دمج المناطق من قاعدة البيانات مع القائمة المسبقة
  const allAreaNames = Array.from(
    new Set([
      ...dbAreas.map(r => r.name),
      ...ABU_AL_KHASEEB_AREAS
    ])
  )

  // 2. تصفية بالمطابقة الجزئية (includes)
  const exactOrPartial = allAreaNames.filter(name =>
    normalizeArabic(name).includes(cleanQ)
  )

  // 3. البحث بالتشابه الإملائي (Fuzzy Matching عبر Levenshtein)
  const scored = allAreaNames.map(name => {
    const norm = normalizeArabic(name)
    const dist = levenshteinDistance(cleanQ, norm)
    return { name, dist }
  })

  // فرز الأقرب
  scored.sort((a, b) => a.dist - b.dist)

  const suggestions: string[] = []
  const closest = scored[0]

  // إذا كانت أقرب كلمة مسافتها قليلة ولم تكن ضمن المطابقة الجزئية
  if (closest && closest.dist <= 3 && !exactOrPartial.includes(closest.name)) {
    suggestions.push(`هل تقصد: ${closest.name}؟`)
  }

  // تجميع قائمة المناطق المعروضة
  const finalAreas = Array.from(
    new Set([
      ...exactOrPartial,
      ...(closest && closest.dist <= 3 ? [closest.name] : []),
      ...scored.slice(0, 5).map(s => s.name)
    ])
  ).slice(0, 8)

  return NextResponse.json({
    query,
    suggestions,
    areas: finalAreas,
    bestMatch: closest ? closest.name : null
  })
}
