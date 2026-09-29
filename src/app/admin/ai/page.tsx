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
  PackagePlus,
  MapPin,
  Phone,
  DollarSign,
  Clock,
  FileText,
  Users,
  CheckSquare,
  Square,
  ArrowLeft
} from "lucide-react";

type ChatMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  type?: "text" | "type_selection" | "preparer_selection" | "area_suggestions" | "summary";
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
  items?: string[];
  selectedPreparers?: string[];
};

export default function AdminAiPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome_init",
      sender: "ai",
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! المساعد الذكي الخارق في خدمتك 🚀\nتگدر تسألني، تصفر حساب مندوب، تسند طلب، تكول 'سويلي طلب'، أو تدزلي رسالة طلب كاملة (أول سطرين رقم ومنطقة وباقي الأسطر مواد)!",
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
    "idle" | "awaiting_type" | "awaiting_phone" | "awaiting_area" | "awaiting_price" | "awaiting_items" | "awaiting_preparers" | "awaiting_landmark" | "awaiting_time"
  >("idle");
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({});
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  
  // قائمة المجهزين والموردين المتاحين
  const [availablePreparers, setAvailablePreparers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPreparersMap, setSelectedPreparersMap] = useState<{ [key: string]: boolean }>({});

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // جلب المجهزين عند بدء التشغيل
  useEffect(() => {
    fetch("/api/preparers-and-suppliers")
      .then(res => res.json())
      .then(data => {
        const list = [
          ...(data.preparers || []),
          ...(data.suppliers || [])
        ];
        setAvailablePreparers(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, areaSuggestions, wizardStep]);

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

  // معالجة اختيار نوع الطلب (الأزرار الأربعة)
  const handleSelectOrderType = (type: string) => {
    setOrderDraft(prev => ({ ...prev, orderType: type }));
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: `نوع الطلب: ${type}`,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };

    if (type === "تجهيز طلب") {
      setWizardStep("awaiting_area");
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `تمام يا أبو الأكبر! اخترنا **تجهيز طلب** 📦\nأولاً: انطيني **اسم المنطقة** (مثلاً: نهر خوز، محيلة، سيحان):`,
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, userMsg, aiMsg]);
      speak("تمام يا أبو الأكبر! اخترنا تجهيز طلب. أولاً انطيني اسم المنطقة");
      fetchAreaSuggestions("");
    } else {
      setWizardStep("awaiting_phone");
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `تمام يا أبو الأكبر، سجلت نوع الطلب (${type}) 📝\nهسه انطيني **رقم هاتف الزبون** (ضروري):`,
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, userMsg, aiMsg]);
      speak(`تمام يا أبو الأكبر، سجلت نوع الطلب. هسه انطيني رقم هاتف الزبون`);
    }
  };

  // تأكيد واختيار المجهزين والانتقال لإنشاء الطلب
  const handleConfirmPreparersAndProceed = async () => {
    const selectedNames = Object.keys(selectedPreparersMap).filter(k => selectedPreparersMap[k]);
    const finalDraft: OrderDraft = {
      ...orderDraft,
      selectedPreparers: selectedNames.length > 0 ? selectedNames : ["المتجر الرئيسي"]
    };

    setWizardStep("idle");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "انشاء طلب تجهيز", stepData: finalDraft })
      });
      const data = await res.json();
      setIsLoading(false);

      const reply = data.message || "تم إنشاء وتجهيز الطلب بنجاح ✅";
      const currentTime = new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "ai",
          text: `🎉 **${reply}**\n\n📦 **بيانات التجهيز:**\n• الهاتف: ${finalDraft.customerPhone || "غير محدد"}\n• المنطقة: ${finalDraft.area}\n• المجهزون: ${finalDraft.selectedPreparers?.join(", ")}\n• المواد: ${finalDraft.items?.join(" ، ") || "عام"}`,
          timestamp: currentTime
        }
      ]);
      speak(reply);
      setOrderDraft({});
      setSelectedPreparersMap({});
    } catch (e) {
      setIsLoading(false);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  // إرسال الرسالة أو الإجابة
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

    // مسار تجهيز الطلب:
    if (orderDraft.orderType === "تجهيز طلب") {
      if (wizardStep === "awaiting_area") {
        setOrderDraft(prev => ({ ...prev, area: clean }));
        setWizardStep("awaiting_phone");
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `عاشت إيدك! المنطقة: ${clean} 📍\nهسه انطيني **رقم هاتف الزبون**:`;
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
        ]);
        speak(reply);
        return;
      }

      if (wizardStep === "awaiting_phone") {
        setOrderDraft(prev => ({ ...prev, customerPhone: clean }));
        setWizardStep("awaiting_items");
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `سجلت الهاتف: ${clean} 📱\nهسه اكتب أو كول **قائمة المنتجات والمواد** المطلوبة (كل مادة بسطر):`;
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
        ]);
        speak(reply);
        return;
      }

      if (wizardStep === "awaiting_items") {
        const itemsList = clean.split("\n").map(s => s.trim()).filter(Boolean);
        setOrderDraft(prev => ({ ...prev, items: itemsList }));
        setWizardStep("awaiting_preparers");
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `سجلت ${itemsList.length} منتجات 🛒\nهسه اختار المجهزين والموردين من القائمة أدناه ثم اضغط **التالي**:`;
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: reply,
            type: "preparer_selection",
            timestamp: currentTime
          }
        ]);
        speak(reply);
        return;
      }
    }

    // مسار الطلب العادي (من الإدارة / وجهتين / من محل):
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
      const finalDraft: OrderDraft = {
        ...orderDraft,
        deliveryTime: clean
      };
      
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

    // فحص ما إذا كتب "سويلي طلب"
    if (clean.includes("سويلي طلب") || clean.includes("سوي طلب") || clean.includes("طلب جديد")) {
      setIsLoading(false);
      isSendingRef.current = false;
      setWizardStep("awaiting_type");
      
      const reply = "تأمرني أمر يا أبو الأكبر! اختار نوع الطلب من الخيارات الأربعة أدناه 🚀";
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

    // إرسال الأمر العام أو الرسالة الكاملة لمسار AI Agent
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean })
      });
      const data = await res.json();
      setIsLoading(false);
      isSendingRef.current = false;

      // إذا كانت الرسالة كاملة واستخرج منها الهاتف والمنطقة وقائمة المواد
      if (data.isFullMessageOrder && data.extractedData) {
        setOrderDraft(data.extractedData);
        setWizardStep("awaiting_preparers");
        
        const reply = `تم تحليل رسالة الطلب بنجاح يا أبو الأكبر! 📦\n• المنطقة: ${data.extractedData.area}\n• الهاتف: ${data.extractedData.customerPhone}\n• المواد (${data.extractedData.items.length}): ${data.extractedData.items.join(" ، ")}\n\nيرجى تحديد المجهزين والموردين من القائمة أدناه ثم النقر على **التالي**:`;
        
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: reply,
            type: "preparer_selection",
            timestamp: currentTime
          }
        ]);
        speak("تم استخراج بيانات الطلب. يرجى تحديد المجهزين ثم النقر على التالي");
        return;
      }

      if (data.needType) {
        setWizardStep("awaiting_type");
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: data.message || "اختار نوع الطلب:",
            type: "type_selection",
            timestamp: currentTime
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: data.message || "تم التنفيذ", timestamp: currentTime }
        ]);
      }
      speak(data.message || "");
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
    setSelectedPreparersMap({});
    setAreaSuggestions([]);
    setMessages([
      {
        id: "cleared_init",
        sender: "ai",
        text: "تم تصفير المحادثة والذاكرة بنجاح يا أبو الأكبر! تفضل بأمرك الجديد 🚀",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B1220] via-[#0F172A] to-[#020617] text-white flex flex-col dir-rtl select-none">
      {/* الهيدر العلوي الفاخر */}
      <header className="px-4 py-3.5 bg-[#0F172A]/80 backdrop-blur-2xl border-b border-white/[0.08] flex items-center justify-between sticky top-0 z-50 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3">
          <Link
            href="/abo1stor3hlaa2kbr8-47"
            className="p-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white rounded-2xl border border-white/10 transition-colors flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>لوحة الإدارة</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-400 via-blue-600 to-indigo-600 p-[1.5px] flex items-center justify-center shadow-lg shadow-sky-500/20">
              <div className="w-full h-full rounded-2xl bg-[#0B1220] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                <span>المساعد الذكي الخارق</span>
                <span className="text-[10px] px-2 py-0.5 bg-sky-500/15 text-sky-300 rounded-full font-mono border border-sky-400/25">
                  Gemini Live
                </span>
              </h1>
              <p className="text-[11px] text-white/50 truncate max-w-[200px]">{statusText}</p>
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
                : "bg-white/5 text-sky-400 border-white/10 hover:bg-white/10"
            }`}
            title={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            onClick={clearChat}
            className="p-2 bg-white/5 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 border border-white/10 rounded-2xl transition-colors"
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
              className={`relative max-w-[88%] rounded-3xl p-4 shadow-[0_8px_32px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all group ${
                msg.sender === "user"
                  ? "bg-gradient-to-tr from-sky-600 to-blue-600 text-white rounded-br-none border border-white/20"
                  : "bg-[#121A2B]/85 text-slate-100 rounded-bl-none border border-white/[0.08]"
              }`}
            >
              {/* زر القلم لتعديل الرسالة */}
              {msg.sender === "user" && msg.editableText && (
                <button
                  onClick={() => setInputMessage(msg.editableText!)}
                  className="absolute -left-7 top-2 p-1.5 bg-[#1E293B] hover:bg-sky-600 text-white/60 hover:text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity border border-white/10 shadow-sm"
                  title="تعديل الرسالة وإعادة إرسالها"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}

              <p className="text-sm leading-relaxed whitespace-pre-line font-medium">{msg.text}</p>
              
              <span
                className={`block text-[10px] mt-1.5 text-left font-mono ${
                  msg.sender === "user" ? "text-sky-200/80" : "text-white/40"
                }`}
              >
                {msg.timestamp}
              </span>
            </div>

            {/* الخيارات الأربعة لنوع الطلب: 1- من الإدارة 2- وجهتين 3- من محل 4- تجهيز طلب */}
            {msg.type === "type_selection" && wizardStep === "awaiting_type" && (
              <div className="grid grid-cols-2 gap-2.5 w-full max-w-[95%] mt-2">
                <button
                  onClick={() => handleSelectOrderType("من الإدارة")}
                  className="p-3.5 bg-[#162032] hover:bg-[#1F2C47] border border-white/[0.08] hover:border-sky-400/50 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-right shadow-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">1- من الإدارة</h4>
                    <p className="text-[10px] text-white/50">إضافة طلب إداري مباشر</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectOrderType("وجهتين")}
                  className="p-3.5 bg-[#162032] hover:bg-[#1F2C47] border border-white/[0.08] hover:border-indigo-400/50 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-right shadow-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <RefreshCw className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">2- وجهتين</h4>
                    <p className="text-[10px] text-white/50">توصيل واستلام مركب</p>
                  </div>
                </button>

                <button
                  onClick={() => handleSelectOrderType("من محل")}
                  className="p-3.5 bg-[#162032] hover:bg-[#1F2C47] border border-white/[0.08] hover:border-blue-400/50 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-right shadow-sm"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">3- من محل</h4>
                    <p className="text-[10px] text-white/50">طلب مسجل لمتجر محدد</p>
                  </div>
                </button>

                {/* الخيار الرابع: تجهيز طلب */}
                <button
                  onClick={() => handleSelectOrderType("تجهيز طلب")}
                  className="p-3.5 bg-gradient-to-r from-emerald-950/60 to-[#162032] hover:from-emerald-900/60 border border-emerald-500/30 hover:border-emerald-400/60 rounded-2xl flex items-center gap-3 transition-all active:scale-95 text-right shadow-md shadow-emerald-950/30"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <PackagePlus className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">4- تجهيز طلب</h4>
                    <p className="text-[10px] text-emerald-200/60">منطقة + هاتف + منتجات</p>
                  </div>
                </button>
              </div>
            )}

            {/* قائمة المجهزين والموردين بـ Checkboxes */}
            {msg.type === "preparer_selection" && wizardStep === "awaiting_preparers" && (
              <div className="w-full max-w-[95%] p-4 bg-[#121A2B]/90 border border-emerald-500/30 rounded-3xl space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Users className="w-4 h-4" />
                    <span>حدد المجهزين والموردين المطلوبين:</span>
                  </div>
                  <span className="text-[10px] text-white/50">
                    تم اختيار: {Object.values(selectedPreparersMap).filter(Boolean).length}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availablePreparers.map(prep => {
                    const isChecked = !!selectedPreparersMap[prep.name];
                    return (
                      <button
                        key={prep.id}
                        onClick={() => {
                          setSelectedPreparersMap(prev => ({
                            ...prev,
                            [prep.name]: !prev[prep.name]
                          }));
                        }}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all text-right ${
                          isChecked
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                            : "bg-[#1A2336] border-white/5 text-white/70 hover:bg-[#232F4A]"
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-white/30 shrink-0" />
                        )}
                        <span className="truncate">{prep.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/10">
                  <button
                    onClick={handleConfirmPreparersAndProceed}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/25 active:scale-95 transition-all"
                  >
                    <span>التالي وتثبيت الطلب</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sky-400 bg-[#121A2B]/80 p-3 rounded-2xl w-fit border border-white/10 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold">جاري المعالجة والتنفيذ...</span>
          </div>
        )}

        {/* شريط اقتراحات المناطق السريعة */}
        {areaSuggestions.length > 0 && wizardStep === "awaiting_area" && (
          <div className="p-3.5 bg-[#121A2B]/95 border border-sky-400/30 rounded-2xl space-y-2.5 animate-fadeIn shadow-lg">
            <div className="flex items-center gap-1.5 text-xs text-sky-400 font-bold">
              <MapPin className="w-4 h-4" />
              <span>اقتراحات المناطق القريبة (انقر للاختيار المباشر):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areaSuggestions.map((area, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const cleaned = area.replace("هل تقصد: ", "").replace("؟", "");
                    sendMessage(cleaned);
                  }}
                  className="px-3.5 py-2 bg-[#1A2336] hover:bg-sky-600 hover:text-white border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition-colors shadow-sm"
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* الشريط السفلي للإدخال والصوت */}
      <footer className="fixed bottom-0 left-0 right-0 p-3 bg-[#0B1220]/95 backdrop-blur-2xl border-t border-white/10 z-50">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          {/* زر الميكروفون */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${
              isListening
                ? "bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-500/40"
                : "bg-white/5 hover:bg-white/10 text-sky-400 border border-white/10"
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
                  : wizardStep === "awaiting_items"
                  ? "اكتب قائمة المواد (مثال: لحم بعجين، صمون)..."
                  : wizardStep === "awaiting_landmark"
                  ? "أدخل النقطة الدالة أو اكتب 'ماكو'..."
                  : wizardStep === "awaiting_time"
                  ? "أدخل وقت التوصيل أو الملاحظة..."
                  : "تحدث أو اكتب أمرك هنا (أو الصق رسالة طلب كاملة)..."
              }
              className="w-full bg-[#121A2B]/90 text-white placeholder-white/40 text-sm px-4 py-3.5 rounded-2xl border border-white/10 focus:outline-none focus:border-sky-400 transition-colors shadow-inner"
            />
          </div>

          {/* زر الإرسال */}
          <button
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-sky-500/25 active:scale-95"
            title="إرسال"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
