import { NextResponse } from 'next/server'

const AREAS = [
  "نهر خوز",
  "نهر خوز طريزاوية",
  "نهر خوز الشمالي",
  "ابو الخصيب مركز",
  "محيلة",
  "باب طويل",
  "البلد",
  "البهادرية",
  "سيحان",
  "العوجة",
  "جيكور",
  "المطيحة",
  "ابو مغيرة",
  "الشخاطرة",
  "حمدان",
  "الصالحية",
  "مناوي باشا",
  "الجزائر",
  "الجبيلة",
  "البراضعية",
  "الطويسة"
]

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || "").toLowerCase().trim()
    
    if (!q) {
      return NextResponse.json({ areas: AREAS.slice(0, 5) })
    }

    const filtered = AREAS.filter(a => a.toLowerCase().includes(q) || q.includes(a.split(" ")[0])).slice(0, 5)

    if (filtered.length === 0 && (q.includes("بوز") || q.includes("حوز") || q.includes("خوز"))) {
      return NextResponse.json({
        areas: ["هل تقصد: نهر خوز؟", "هل تقصد: نهر خوز طريزاوية؟", "نهر خوز الشمالي"]
      })
    }

    return NextResponse.json({ areas: filtered.length ? filtered : AREAS.slice(0, 3) })
  } catch (error: any) {
    return NextResponse.json({ areas: AREAS.slice(0, 3) })
  }
}
