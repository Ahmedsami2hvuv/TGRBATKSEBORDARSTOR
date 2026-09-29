"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  Loader2,
  Trash2,
  ArrowRight,
  Edit2,
  CheckCircle2,
  Building2,
  Store,
  RefreshCw,
  MapPin,
  Phone,
  DollarSign,
  Clock,
  FileText
} from "lucide-react";

type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  type?: "text" | "type_selection" | "area_suggestions" | "summary";
  suggestions?: string[];
  editableText?: string;
};

type OrderDraft = {
  orderType?: string;
  shopName?: string;
  customerPhone?: string;
  area?: string;
  price?: string;
  landmark?: string;
  deliveryTime?: string;
  notes?: string;
};

export default function AdminAiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_init",
      sender: "ai",
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! المساعد الذكي الخارق في خدمتك 🚀\nتگدر تسألني، تطلب تصفير حساب، اسناد طلب، أو دگلي 'سويلي طلب' بصوتك أو كتابة!",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusText, setStatusText] = useState("المساعد الذكي الخارق جاهز");
  
  // حالة المعالج متعدد الخطوات
  const [wizardStep, setWizardStep] = useState<
    "idle" | "awaiting_type" | "awaiting_phone" | "awaiting_area" | "awaiting_price" | "awaiting_landmark" | "awaiting_time" | "ready_to_create"
  >("idle");
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({});
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, areaSuggestions]);

  // نطق الرد
  const speak = (text: string) => {
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

  // تشغيل الميكروفون
  const startListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("التعرف الصوتي غير مدعوم بهذا المتصفح.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const rec = new SpeechRec();
      rec.lang = "ar-IQ";
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        setStatusText("🎙️ استمع لك يا أبو الأكبر... تفضل بالتحدث");
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInputMessage(transcript);
        
        // إذا كان ينتظر منطقة، نبحث في الـ API تلقائياً
        if (wizardStep === "awaiting_area" && transcript.trim().length > 1) {
          fetchAreaSuggestions(transcript.trim());
        }
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

  // جلب اقتراحات المناطق
  const fetchAreaSuggestions = async (query: string) => {
    try {
      const res = await fetch(`/api/areas/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.areas && Array.isArray(data.areas)) {
        setAreaSuggestions(data.areas);
      }
    } catch (e) {}
  };

  // معالجة اختيار نوع الطلب
  const handleSelectOrderType = (type: string) => {
    setOrderDraft(prev => ({ ...prev, orderType: type }));
    setWizardStep("awaiting_phone");
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: `نوع الطلب: ${type}`,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };
    
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: "ai",
      text: `تمام يا أبو الأكبر، سجلت نوع الطلب (${type}) 📝\nهسه انطيني **رقم هاتف الزبون** (ضروري):`,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    speak(`تمام يا أبو الأكبر، سجلت نوع الطلب. هسه انطيني رقم هاتف الزبون`);
  };

  // إرسال الرسالة أو الخطوة
  const sendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || isSendingRef.current) return;

    isSendingRef.current = true;
    setInputMessage("");
    setAreaSuggestions([]);
    stopListening();

    const currentTime = new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

    // إضافة رسالة المستخدم
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: clean,
      editableText: clean,
      timestamp: currentTime
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    // --- مسار المعالج المتعدد الخطوات للطلب ---
    if (wizardStep === "awaiting_phone") {
      setOrderDraft(prev => ({ ...prev, customerPhone: clean }));
      setWizardStep("awaiting_area");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `عاشت إيدك! رقم الهاتف: ${clean}\nهسه انطيني **منطقة الزبون** (مثلاً: نهر خوز، محيلة، سيحان):`;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
      ]);
      speak(reply);
      fetchAreaSuggestions("");
      return;
    }

    if (wizardStep === "awaiting_area") {
      setOrderDraft(prev => ({ ...prev, area: clean }));
      setWizardStep("awaiting_price");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `سجلت المنطقة: ${clean} 📍\nهسه انطيني **السعر الإجمالي للطلب** (مثلاً: 15000 أو 25):`;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
      ]);
      speak(reply);
      return;
    }

    if (wizardStep === "awaiting_price") {
      setOrderDraft(prev => ({ ...prev, price: clean }));
      setWizardStep("awaiting_landmark");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `تمام! السعر: ${clean} د.ع 💰\nأكو **نقطة دالة أو لوكيشن** للزبون؟ (إذا ماكو اكتب: ماكو أو تخطي):`;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
      ]);
      speak(reply);
      return;
    }

    if (wizardStep === "awaiting_landmark") {
      const landmarkVal = (clean === "ماكو" || clean === "تخطي" || clean === "لا") ? "" : clean;
      setOrderDraft(prev => ({ ...prev, landmark: landmarkVal }));
      setWizardStep("awaiting_time");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `سجلت النقطة الدالة 📌\nآخر شي: شوكت **وقت التوصيل أو الملاحظة**؟ (مثلاً: هسه، العصر، فوري):`;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
      ]);
      speak(reply);
      return;
    }

    if (wizardStep === "awaiting_time") {
      const timeVal = clean;
      const finalDraft: OrderDraft = {
        ...orderDraft,
        deliveryTime: timeVal
      };
      setOrderDraft(finalDraft);
      setWizardStep("ready_to_create");
      
      // إرسال الطلب النهائي للسيرفر
      try {
        const res = await fetch("/api/ai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: "انشاء طلب مكتمل", stepData: finalDraft })
        });
        const data = await res.json();
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = data.message || "تم إنشاء الطلب بنجاح ✅";
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: `🎉 **${reply}**\n\n📋 **ملخص الطلب:**\n• النوع: ${finalDraft.orderType}\n• الهاتف: ${finalDraft.customerPhone}\n• المنطقة: ${finalDraft.area}\n• السعر: ${finalDraft.price} د.ع\n• الوقت: ${finalDraft.deliveryTime}`,
            timestamp: currentTime
          }
        ]);
        speak(reply);
        setWizardStep("idle");
        setOrderDraft({});
      } catch (err) {
        setIsLoading(false);
        isSendingRef.current = false;
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: "⚠️ تعذر إكمال إنشاء الطلب بالسيرفر.", timestamp: currentTime }
        ]);
      }
      return;
    }

    // --- فحص ما إذا كان المستخدم يطلب إنشاء طلب جديد ---
    if (clean.includes("سويلي طلب") || clean.includes("سوي طلب") || clean.includes("طلب جديد")) {
      setIsLoading(false);
      isSendingRef.current = false;
      setWizardStep("awaiting_type");
      
      const reply = "تأمرني أمر يا أبو الأكبر! اختار نوع الطلب حتى نبدي نسجله خطوة بخطوة 🚀";
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: reply,
          type: "type_selection",
          timestamp: currentTime
        }
      ]);
      speak(reply);
      return;
    }

    // --- إرسال الأوامر المباشرة الأخرى إلى محرك AI Agent ---
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean })
      });
      const data = await res.json();
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = data.message || "تم استلام الأمر بنجاح.";
      if (data.needType) {
        setWizardStep("awaiting_type");
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: reply,
            type: "type_selection",
            timestamp: currentTime
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
        ]);
      }
      speak(reply);
    } catch (err) {
      setIsLoading(false);
      isSendingRef.current = false;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: "❌ تعذر الاتصال بالسيرفر", timestamp: currentTime }
      ]);
    }
  };

  // تصفير الدردشة
  const clearChat = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setWizardStep("idle");
    setOrderDraft({});
    setAreaSuggestions([]);
    setMessages([
      {
        id: "cleared_init",
        sender: "ai",
        text: "تم تصفير المحادثة والذاكرة بنجاح يا أبو الأكبر! تفضل بأمرك أو طلبك الجديد 🚀",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  // تعديل رسالة سابقة
  const handleEditMessage = (text: string) => {
    setInputMessage(text);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col dir-rtl select-none">
      {/* الهيدر العلوي الفاخر */}
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
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 p-0.5 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full rounded-2xl bg-slate-950 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>المساعد الذكي الخارق</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/20 text-sky-400 rounded-full font-mono border border-sky-500/30">
                  AI Agent
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{statusText}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              if (!isMuted && typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
            className={`p-2 rounded-2xl border transition-all ${
              isMuted
                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                : "bg-slate-800 text-sky-400 border-slate-700 hover:bg-slate-700"
            }`}
            title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 bg-slate-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-slate-700 rounded-2xl transition-colors"
            title="تصفير المحادثة"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* منطقة الرسائل والمحادثة */}
      <main ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto pb-36">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"} space-y-1.5`}
          >
            <div
              className={`relative max-w-[85%] rounded-3xl p-4 shadow-md transition-all group ${
                msg.sender === "user"
                  ? "bg-gradient-to-tr from-sky-600 to-blue-600 text-white rounded-br-none border border-sky-400/20"
                  : "bg-slate-900/90 text-slate-100 rounded-bl-none border border-slate-800"
              }`}
            >
              {/* زر القلم لتعديل الرسالة */}
              {msg.sender === "user" && msg.editableText && (
                <button
                  onClick={() => handleEditMessage(msg.editableText!)}
                  className="absolute -left-7 top-2 p-1.5 bg-slate-800 hover:bg-sky-600 text-slate-400 hover:text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  title="تعديل الرسالة وإعادة إرسالها"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              <p className="text-sm leading-relaxed whitespace-pre-line font-medium">{msg.text}</p>
              
              <span
                className={`block text-[10px] mt-1.5 text-left font-mono ${
                  msg.sender === "user" ? "text-sky-200/80" : "text-slate-400"
                }`}
              >
                {msg.timestamp}
              </span>
            </div>

            {/* أزرار اختيار نوع الطلب */}
            {msg.type === "type_selection" && wizardStep === "awaiting_type" && (
              <div className="grid grid-cols-3 gap-2 w-full max-w-[90%] mt-2">
                <button
                  onClick={() => handleSelectOrderType("من الإدارة")}
                  className="p-3 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-sky-900/40 hover:to-sky-800/40 border border-slate-700 hover:border-sky-500/50 rounded-2xl flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
                >
                  <Building2 className="w-5 h-5 text-sky-400" />
                  <span className="text-xs font-bold text-slate-200">من الإدارة</span>
                </button>
                <button
                  onClick={() => handleSelectOrderType("وجهتين")}
                  className="p-3 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-indigo-900/40 hover:to-indigo-800/40 border border-slate-700 hover:border-indigo-500/50 rounded-2xl flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
                >
                  <RefreshCw className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs font-bold text-slate-200">وجهتين</span>
                </button>
                <button
                  onClick={() => handleSelectOrderType("من محل")}
                  className="p-3 bg-gradient-to-b from-slate-800 to-slate-900 hover:from-blue-900/40 hover:to-blue-800/40 border border-slate-700 hover:border-blue-500/50 rounded-2xl flex flex-col items-center gap-1.5 transition-all active:scale-95 text-center"
                >
                  <Store className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-bold text-slate-200">من محل</span>
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sky-400 bg-slate-900/60 p-3 rounded-2xl w-fit border border-slate-800 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">جاري التنفيذ والمعالجة...</span>
          </div>
        )}

        {/* شريط اقتراحات المناطق السريعة */}
        {areaSuggestions.length > 0 && wizardStep === "awaiting_area" && (
          <div className="p-3 bg-slate-900/90 border border-sky-500/30 rounded-2xl space-y-2 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold">
              <MapPin className="w-3.5 h-3.5" />
              <span>اقتراحات المناطق المتاحة (انقر للاختيار):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areaSuggestions.map((area, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const cleaned = area.replace("هل تقصد: ", "").replace("؟", "");
                    sendMessage(cleaned);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-sky-600 hover:text-white border border-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-colors"
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* الشريط السفلي للإدخال والصوت */}
      <footer className="fixed bottom-0 left-0 right-0 p-3 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {/* زر الميكروفون */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
              isListening
                ? "bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-500/40"
                : "bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700"
            }`}
            title={isListening ? "إيقاف الاستماع" : "تحدث بالصوت"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* حقل الإدخال النصي */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputMessage}
              onChange={e => {
                setInputMessage(e.target.value);
                if (wizardStep === "awaiting_area" && e.target.value.trim().length > 0) {
                  fetchAreaSuggestions(e.target.value.trim());
                }
              }}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(inputMessage);
                }
              }}
              placeholder={
                wizardStep === "awaiting_phone"
                  ? "أدخل رقم هاتف الزبون..."
                  : wizardStep === "awaiting_area"
                  ? "أدخل منطقة الزبون..."
                  : wizardStep === "awaiting_price"
                  ? "أدخل السعر الإجمالي..."
                  : wizardStep === "awaiting_landmark"
                  ? "أدخل النقطة الدالة أو اكتب 'ماكو'..."
                  : wizardStep === "awaiting_time"
                  ? "أدخل وقت التوصيل أو الملاحظة..."
                  : "تحدث أو اكتب أمرك هنا (مثال: سويلي طلب)..."
              }
              className="w-full bg-slate-900/90 text-white placeholder-slate-500 text-sm px-4 py-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-sky-500 transition-colors"
            />
          </div>

          {/* زر الإرسال */}
          <button
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-sky-500/20 active:scale-95"
            title="إرسال"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
