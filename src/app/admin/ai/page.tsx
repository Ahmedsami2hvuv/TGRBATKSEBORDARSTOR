"use client"

import React, { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  sender: "user" | "ai"
  text: string
  action?: string
  status?: "success" | "error"
  timestamp: string
}

export default function AdminAiAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "أهلاً بك يا أبو الأكبر! أنا المدير التنفيذي الذكي للمنصة 🚀\nاكتبلي أي أمر بالعراقي (مثلاً: صفر حساب فارس، اخفي المندوب، اسند طلب 2815 لفارس، غير حالة طلب الى واصل) وراح أنفذه فوراً بدون أي تردد!",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const quickCommands = [
    "صفر حساب فارس",
    "اخفي المندوب فارس",
    "اظهر المندوب فارس",
    "اسند طلب 2815 الى فارس",
    "غير حالة طلب 2815 الى واصل",
    "حول طلب 2815 الى تجهيز"
  ]

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const handleSend = async (commandToSend?: string) => {
    const textToSend = commandToSend || input
    if (!textToSend.trim() || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }

    setMessages((prev) => [...prev, userMsg])
    if (!commandToSend) setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      })

      const data = await res.json()

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: data.done ? data.message : `❌ ${data.error || "تعذر تنفيذ الأمر"}`,
        action: data.action,
        status: data.done ? "success" : "error",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: `⚠️ خطأ في الاتصال بالخادم: ${err?.message || "يرجى المحاولة مجدداً"}`,
          status: "error",
          timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center p-3 sm:p-6"
    >
      <div className="w-full max-w-4xl bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col h-[92vh] overflow-hidden">
        {/* شريط الرأس */}
        <div className="px-6 py-4 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-400 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/20">
                🤖
              </div>
              <span className="absolute -bottom-1 -left-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                المدير التنفيذي الذكي (AI Agent)
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  خارق ومباشر
                </span>
              </h1>
              <p className="text-xs text-slate-400">aboakbr.com — متصل بقاعدة البيانات ومنفذ للأوامر بدون تردد</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs px-3 py-1 rounded-xl bg-slate-800/80 text-slate-300 border border-slate-700">
              مدعوم بـ Gemini & Prisma
            </span>
          </div>
        </div>

        {/* الأوامر السريعة */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/60 overflow-x-auto flex gap-2 no-scrollbar">
          <span className="text-xs text-slate-400 whitespace-nowrap self-center ml-2">أوامر سريعة:</span>
          {quickCommands.map((cmd, i) => (
            <button
              key={i}
              onClick={() => handleSend(cmd)}
              disabled={loading}
              className="text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 hover:border-emerald-500/50 rounded-xl px-3 py-1.5 whitespace-nowrap transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              ⚡ {cmd}
            </button>
          ))}
        </div>

        {/* منطقة المحادثة */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === "user"
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4 shadow-md transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm"
                      : m.status === "error"
                      ? "bg-rose-950/60 border border-rose-800 text-rose-200 rounded-bl-sm"
                      : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-xs font-semibold opacity-75">
                      {isUser ? "أنت (أبو الأكبر)" : "المساعد التنفيذي"}
                    </span>
                    <span className="text-[10px] opacity-60">{m.timestamp}</span>
                  </div>
                  <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed font-medium">
                    {m.text}
                  </p>
                  {m.action && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center gap-2 text-xs text-emerald-400 font-mono">
                      <span>✓ العملية:</span>
                      <span className="bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700">
                        {m.action}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex justify-end">
              <div className="bg-slate-800/80 border border-slate-700 rounded-3xl rounded-bl-sm p-4 text-slate-300 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]"></div>
                </div>
                <span className="text-xs font-medium">جاري معالجة الأمر وتنفيذه فوراً...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* حقل الإدخال والإرسال */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب أمرك بالعراقي هنا... (مثال: صفر حساب فارس، اسند طلب 2815 لفارس)"
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-3.5 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-6 py-3.5 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center gap-2"
            >
              <span>تنفيذ</span>
              <span className="text-lg">⚡</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
