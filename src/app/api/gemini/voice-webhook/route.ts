import { NextResponse } from 'next/server'

// Gemini voice webhook disabled: Gemini has been removed from the site.
export async function POST() {
  return NextResponse.json({
    success: false,
    message: "تم إيقاف ميزة Gemini الصوتية."
  }, { status: 410 })
}
