"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Loader2,
  Trash2,
  ArrowRight,
  CheckCircle2,
  Package,
  Bike,
  Coins,
  RefreshCw,
  BarChart3
} from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  action?: string;
  orderNumber?: number;
  data?: any;
};

export default function AdminAiPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹\nأنا وكيلك الذكي المتصل مباشرة بقاعدة البيانات. احجي وياي بالعراقي أو اكتب براحتك، أكدر:\n\n• أسويلك طلب جديد برمشة عين 🚀\n• أصَفّر حساب أي مندوب سدد حسابه 💰\n• أسند أي طلب للمندوب 🛵\n• أغير حالة أي طلب ✅\n• أنطيك إحصائيات وملخص النظام 📊",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // إعداد التعرف الصوتي (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "ar-IQ";

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("التعرف على الصوت غير مدعوم في هذا المتصفح");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text })
      });

      const data = await res.json();

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: "ai",
        text: data.message || "تم تنفيذ طلبك بنجاح ✅",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }),
        action: data.action,
        orderNumber: data.orderNumber,
        data: data.data
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: "ai",
          text: "⚠️ تعذر الاتصال بالخادم، يرجى المحاولة مرة ثانية.",
          timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome_new",
        sender: "ai",
        text: "يا هلا أبو الأكبر! بدأت محادثة جديدة، تفضل شتريد أسويلك؟ 🚀",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* الشريط العلوي */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
            title="الرجوع للوحة التحكم"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white flex items-center gap-1.5">
                الوكيل الذكي
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Supabase Live
                </span>
              </h1>
              <p className="text-xs text-slate-400">يفهم عراقي وينفذ في قاعدة البيانات فوراً</p>
            </div>
          </div>
        </div>

        <button
          onClick={clearChat}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
          title="مسح الدردشة"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"}`}
          >
            <div
              className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-4 shadow-md text-sm sm:text-base leading-relaxed whitespace-pre-line ${
                msg.sender === "user"
                  ? "bg-amber-600 text-white rounded-tr-none self-end"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none self-start"
              }`}
            >
              {msg.text}

              {/* بطاقة الطلب المنشأ إن وجدت */}
              {msg.action === "create_order" && msg.orderNumber && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-xs sm:text-sm text-slate-300 space-y-2">
                  <div className="flex items-center justify-between font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      طلب مثبت #{msg.orderNumber}
                    </span>
                    <Link
                      href={`/admin/orders/${msg.orderNumber}`}
                      target="_blank"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition"
                    >
                      عرض الطلب ↗
                    </Link>
                  </div>
                </div>
              )}

              {/* بطاقة تصفير الحساب */}
              {msg.action === "zero_balance" && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>تم سداد الذمة وتصفير العداد المالي بنجاح في قاعدة البيانات.</span>
                </div>
              )}

              {/* بطاقة إسناد الطلب */}
              {msg.action === "assign_order" && (
                <div className="mt-3 p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-300 flex items-center gap-2">
                  <Bike className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>تم تحويل وإشعار المندوب لاستلام وتوصيل الطلب.</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900 border border-slate-800 p-3 rounded-2xl w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>الوكيل الذكي ينفذ الأمر في قاعدة البيانات...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* أزرار اقتراحات سريعة */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => handleSendMessage("شنو وضع الطلبات اليوم؟")}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1.5 transition"
        >
          <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
          ملخص الطلبات اليوم
        </button>
        <button
          onClick={() => handleSendMessage("سوي طلب للجزائر رقم 07701234567 سعره 25 الف")}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1.5 transition"
        >
          <Package className="w-3.5 h-3.5 text-emerald-400" />
          طلب سريع للجزائر
        </button>
        <button
          onClick={() => handleSendMessage("صفر حساب فارس")}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1.5 transition"
        >
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          صفر حساب فارس
        </button>
      </div>

      {/* حقل الإدخال وزر الصوت والإرسال */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          {/* زر المايكروفون */}
          <button
            type="button"
            onClick={toggleListening}
            className={`p-3 rounded-2xl transition flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-600/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            title={isListening ? "إيقاف التسجيل الصوتي" : "تحدث بالصوت"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* حقل الكتابة */}
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening ? "جاري الاستماع لصوتك..." : "اكتب أمرك بالعراقي أو دوس المايك..."
            }
            disabled={isLoading}
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />

          {/* زر الإرسال */}
          <button
            type="button"
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputMessage.trim()}
            className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition flex items-center justify-center shadow-lg shadow-amber-600/20 shrink-0"
            title="إرسال"
          >
            <Send className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
