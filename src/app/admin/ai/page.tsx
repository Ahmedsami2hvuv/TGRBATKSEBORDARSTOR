"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Volume2, VolumeX, Sparkles, Loader2, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  buttons?: Array<{ text: string; action: string }>;
  timestamp: string;
};

export default function AdminAiDirectPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_init",
      sender: "ai",
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! العقل المدبر والمساعد الذكي Gemini في خدمتك، أطلب أي استعلام أو أمر أو استشارة بصوتك أو كتابة! 🚀✨",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusText, setStatusText] = useState("المساعد الذكي جاهز");

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const speakResponse = (text: string) => {
    if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const cleanText = text
      .replace(/[*#\-]|https?:\/\/\S+/g, "")
      .replace(/[^\u0600-\u06FF\s0-9.,!؟]/g, " ")
      .trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar-IQ";
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("التعرف الصوتي غير مدعوم بهذا المتصفح.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const rec = new SpeechRecognition();
      rec.lang = "ar-IQ";
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setStatusText("🎙️ الميكروفون يستمع لك... تفضل بالتحدث");
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatusText("⚠️ تعذر التقاط الصوت، يمكنك الكتابة بالنص.");
      };

      rec.onend = () => {
        setIsListening(false);
        setStatusText("المساعد الذكي جاهز");
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const sendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || isSendingRef.current) return;

    isSendingRef.current = true;
    setInputMessage("");
    stopListening();

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: clean,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setStatusText("⚡ جاري المعالجة والتنفيذ عبر Gemini...");

    try {
      const res = await fetch("/api/ai/admin-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, userId: "admin_ai_page" })
      });

      const data = await res.json();
      setIsLoading(false);
      isSendingRef.current = false;

      if (data.ok) {
        setStatusText("✅ تم التنفيذ بنجاح");
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: data.reply || "",
          buttons: Array.isArray(data.buttons) ? data.buttons : [],
          timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, aiMsg]);
        speakResponse(data.reply || "");
      } else {
        setStatusText("⚠️ حدث خطأ أثناء المعالجة");
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: data.error || data.message || "حدث خطأ غير متوقع",
          timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err) {
      setIsLoading(false);
      isSendingRef.current = false;
      setStatusText("❌ تعذر الاتصال بالسيرفر");
    }
  };

  const clearChat = async () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setMessages([
      {
        id: "cleared_init",
        sender: "ai",
        text: "تم تصفير الدردشة والذاكرة بنجاح يا أبو الأكبر! تفضل بأمرك أو استفسارك الجديد 🚀",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
    await fetch("/api/ai/admin-voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_session", userId: "admin_ai_page" })
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col dir-rtl select-none">
      {/* Header */}
      <header className="px-4 py-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <Link
            href="/abo1stor3hlaa2kbr8-47"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>لوحة الإدارة</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-indigo-500 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-sky-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-sm leading-tight text-white flex items-center gap-1.5">
                مساعد الذكاء الاصطناعي Gemini
              </h1>
              <p className="text-[11px] text-sky-400 font-medium">{statusText}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={clearChat}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-2xl transition-colors"
            title="مسح سجل المحادثة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              if (next && typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
            className={`p-2.5 rounded-2xl transition-all ${
              isMuted ? "bg-slate-800 text-slate-400" : "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
            }`}
            title={isMuted ? "تشغيل الناطق" : "كتم الناطق"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Chat Messages Body */}
      <main
        ref={chatScrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-4 max-w-3xl w-full mx-auto pb-28 scrollbar-thin scrollbar-thumb-slate-800"
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"} space-y-1`}
          >
            <div
              className={`max-w-[88%] p-3.5 rounded-3xl text-sm leading-relaxed shadow-md whitespace-pre-wrap ${
                msg.sender === "user"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white rounded-tr-none border border-blue-400/30"
                  : "bg-slate-900/90 text-slate-100 rounded-tl-none border border-slate-800"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5 opacity-80 text-[11px] font-bold">
                {msg.sender === "user" ? <span>🎙️ أنـت</span> : <span>✨ الذكاء الاصطناعي Gemini</span>}
              </div>

              <div>{msg.text}</div>

              {msg.buttons && msg.buttons.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 grid grid-cols-2 gap-2">
                  {msg.buttons.map((b, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(b.action || b.text)}
                      className="p-2.5 bg-blue-950/80 hover:bg-blue-900 text-sky-300 font-bold text-xs rounded-xl border border-sky-800/60 transition-colors text-center shadow-sm"
                    >
                      {b.text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-500 px-2">{msg.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2.5 p-3 bg-slate-900/90 rounded-2xl border border-slate-800 text-slate-300 text-xs w-fit">
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
            <span>جاري التفكير والتنفيذ في النظام...</span>
          </div>
        )}
      </main>

      {/* Fixed Bottom Input Area */}
      <footer className="fixed bottom-0 left-0 right-0 p-3 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 z-50 shadow-2xl">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-lg active:scale-95 shrink-0 ${
              isListening
                ? "bg-red-500 text-white animate-pulse ring-4 ring-red-500/30"
                : "bg-gradient-to-tr from-blue-600 to-sky-500 text-white hover:opacity-90"
            }`}
            title={isListening ? "إيقاف الاستماع" : "تحدث بالصوت"}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          <textarea
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(inputMessage);
              }
            }}
            placeholder="تحدث أو اكتب أمرك هنا..."
            className="flex-1 px-4 py-3 text-sm bg-slate-950 text-white rounded-2xl border border-slate-800 focus:outline-none focus:border-sky-500 resize-none max-h-24 leading-relaxed"
          />

          <button
            type="button"
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="w-12 h-12 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-sky-600/30 shrink-0 active:scale-95"
            title="إرسال"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
