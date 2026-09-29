import { NextResponse } from 'next/server'

const KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

let currentKeyIndex = 0

export async function callGemini(prompt: string): Promise<string> {
  if (KEYS.length === 0) throw new Error("لا يوجد مفتاح Gemini")

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = KEYS[currentKeyIndex % KEYS.length]
    const model = models[attempt % models.length]
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      })
      const data = await res.json()
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text
      }
      currentKeyIndex++
    } catch (e) {
      currentKeyIndex++
    }
  }
  throw new Error("فشل الاتصال بجمناي")
}
