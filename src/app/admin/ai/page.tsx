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
  BarChart3,
  ExternalLink,
  KeyRound,
  MapPin,
  Phone,
  DollarSign,
  Clock,
  Store,
  Layers,
} from "lucide-react";

type SpeechRecognitionResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  action?: string;
  orderNumber?: number;
  needType?: boolean;
  selectedCategory?: "single" | "double" | "shop" | "prep";
  pendingAction?: {
    confirmationToken: string;
    preview: {
      model: string;
      operation: "create" | "update" | "delete";
      affectedCount: number;
      filters: Record<string, unknown>;
      data: Record<string, unknown>;
      sample: Array<Record<string, unknown>>;
    };
  };
};

type OrderCategory = "single" | "double" | "shop" | "prep";

const CATEGORIES: { id: OrderCategory; label: string; icon: string; desc: string }[] = [
  { id: "single", label: "📦 وجهة واحدة", icon: "📦", desc: "توصيل من الإدارة لزبون" },
  { id: "double", label: "🔄 وجهتان", icon: "🔄", desc: "من مرسل إلى مستلم" },
  { id: "shop", label: "🏬 من محل", icon: "🏬", desc: "طلب صادر من متجر أو بيج" },
  { id: "prep", label: "🛍️ تجهيز طلب", icon: "🛍️", desc: "قائمة مشتريات ومواد" }
];

const TIME_PRESETS = ["فوري", "الصباح", "العصر", "المساء", "باجر"];

export default function AdminAiPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹\nأكدر أبحث وأجاوبك من جداول النظام. احچي وياي بالعراقي أو اكتب براحتك:\n\n• اسأل عن الطلبات أو المندوبين أو بيانات النظام 📊\n• اطلب إضافة أو تعديل؛ أعرض التفاصيل عليك قبل الحفظ ✅\n• سويلي طلب جديد (وجهة واحدة، وجهتين، من محل، تجهيز) 🚀",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // حالة استمارة الطلب التفصيلية
  const [activeFormMsgId, setActiveFormMsgId] = useState<string | null>(null);
  const [category, setCategory] = useState<OrderCategory>("single");
  const [formData, setFormData] = useState({
    // وجهة واحدة
    customerPhone: "",
    regionName: "جيكور",
    orderType: "توصيل عادي",
    totalAmount: "",
    orderTime: "فوري",

    // وجهتين
    senderPhone: "",
    senderRegionName: "جيكور",
    receiverPhone: "",
    receiverRegionName: "البصرة",

    // طلب من محل
    shopName: "",

    // طلب تجهيز
    prepText: ""
  });
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, activeFormMsgId, category]);

  // إعداد التعرف الصوتي (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const speechWindow = window as SpeechRecognitionWindow;
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "ar-IQ";

        recognition.onresult = (event: SpeechRecognitionResultEvent) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
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
      } catch {
        console.error("تعذر تشغيل التعرف على الصوت.");
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
      const aiMsgId = `ai_${Date.now()}`;

      const aiMsg: Message = {
        id: aiMsgId,
        sender: "ai",
        text: data.message || "تم تنفيذ طلبك بنجاح ✅",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }),
        action: data.action,
        orderNumber: data.orderNumber,
        needType: data.needType,
        selectedCategory: data.selectedCategory || "single",
        pendingAction: data.pendingAction
      };

      setMessages((prev) => [...prev, aiMsg]);

      // إذا كانت الرسالة تتطلب استمارة إدخال
      if (data.needType) {
        setActiveFormMsgId(aiMsgId);
        if (data.selectedCategory) {
          setCategory(data.selectedCategory);
        }
      }
    } catch {
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

  const confirmDatabaseAction = async (message: Message) => {
    const pendingAction = message.pendingAction;
    if (!pendingAction || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationToken: pendingAction.confirmationToken }),
      });
      const result = await response.json();
      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id
            ? {
                ...item,
                text: result.message || "ما اكتمل تنفيذ التغيير.",
                pendingAction: result.done ? undefined : item.pendingAction,
              }
            : item,
        ),
      );
    } catch {
      setMessages((previous) =>
        previous.map((item) =>
          item.id === message.id
            ? { ...item, text: "تعذر الاتصال بالخادم لتنفيذ التغيير. جرّب مرة ثانية." }
            : item,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDatabaseAction = (message: Message) => {
    setMessages((previous) =>
      previous.map((item) =>
        item.id === message.id
          ? { ...item, text: "تم إلغاء التغيير، وما انحفظت أي بيانات.", pendingAction: undefined }
          : item,
      ),
    );
  };

  // إرسال وتثبيت الطلب بحقوله الدقيقة حسب نوعه
  const handleQuickOrderSubmit = async () => {
    // التحقق من الحقول الإجبارية لكل نوع
    if (category === "single") {
      if (!formData.customerPhone.trim()) {
        alert("يرجى إدخال رقم هاتف الزبون");
        return;
      }
    } else if (category === "double") {
      if (!formData.senderPhone.trim() || !formData.receiverPhone.trim()) {
        alert("يرجى إدخال رقم هاتف المرسل ورقم هاتف المستلم");
        return;
      }
    } else if (category === "shop") {
      if (!formData.shopName.trim() || !formData.customerPhone.trim()) {
        alert("يرجى إدخال اسم المحل ورقم هاتف الزبون");
        return;
      }
    } else if (category === "prep") {
      if (!formData.prepText.trim()) {
        alert("يرجى كتابة رسالة التفاصيل والمنتجات المطلوبة للتجهيز");
        return;
      }
    }

    setIsSubmittingOrder(true);
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createOrder: true,
          orderCategory: category,
          customerPhone: formData.customerPhone,
          regionName: formData.regionName,
          orderType: formData.orderType,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          orderTime: formData.orderTime,
          senderPhone: formData.senderPhone,
          senderRegionName: formData.senderRegionName,
          receiverPhone: formData.receiverPhone,
          receiverRegionName: formData.receiverRegionName,
          shopName: formData.shopName,
          prepText: formData.prepText
        })
      });

      const data = await res.json();

      if (data.done && data.orderNumber) {
        setActiveFormMsgId(null);
        const successMsg: Message = {
          id: `ai_order_${Date.now()}`,
          sender: "ai",
          text: data.message || `تم تثبيت الطلب بنجاح برقم #${data.orderNumber} في قاعدة البيانات! 🚀`,
          timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" }),
          action: "create_order",
          orderNumber: data.orderNumber,
        };
        setMessages((prev) => [...prev, successMsg]);
      } else {
        alert(data.message || "حدث خطأ أثناء تثبيت الطلب.");
      }
    } catch {
      alert("تعذر الاتصال بالخادم لتثبيت الطلب.");
    } finally {
      setIsSubmittingOrder(false);
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
    setActiveFormMsgId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* الشريط العلوي */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/abo1stor3hlaa2kbr8-47"
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
              <p className="text-xs text-slate-400">يبحث في بيانات النظام ويعرض التغييرات قبل تنفيذها</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/abo1stor3hlaa2kbr8-47/settings/ai"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
            title="إعداد مفاتيح الذكاء الاصطناعي"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            مفاتيح الذكاء
          </Link>

          <button
            onClick={clearChat}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
            title="مسح الدردشة"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* منطقة الرسائل */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"}`}
          >
            <div
              className={`max-w-[94%] sm:max-w-[80%] rounded-2xl p-4 shadow-md text-sm sm:text-base leading-relaxed whitespace-pre-line ${
                msg.sender === "user"
                  ? "bg-amber-600 text-white rounded-tr-none self-end"
                  : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none self-start"
              }`}
            >
              {msg.text}

              {msg.pendingAction && (
                <div className="mt-3 rounded-xl border border-amber-500/40 bg-slate-950 p-3 text-xs">
                  <p className="font-bold text-amber-300">
                    {msg.pendingAction.preview.operation === "create"
                      ? "إنشاء سجل جديد"
                      : msg.pendingAction.preview.operation === "update"
                        ? "تعديل بيانات"
                        : "حذف بيانات"}
                    {" — "}
                    {msg.pendingAction.preview.model}
                  </p>
                  <p className="mt-1 text-slate-300">
                    عدد السجلات المتأثرة: {msg.pendingAction.preview.affectedCount}
                  </p>
                  {Object.keys(msg.pendingAction.preview.filters || {}).length > 0 && (
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-[10px] text-slate-300">
                      شروط الاستهداف:{"\n"}
                      {JSON.stringify(msg.pendingAction.preview.filters, null, 2)}
                    </pre>
                  )}
                  {msg.pendingAction.preview.operation === "delete" && (
                    <p className="mt-2 text-rose-300">
                      انتبه: الحذف ممكن يأثر على بيانات مرتبطة بهذا السجل.
                    </p>
                  )}
                  {Object.keys(msg.pendingAction.preview.data || {}).length > 0 && (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-[10px] text-slate-300">
                      {JSON.stringify(msg.pendingAction.preview.data, null, 2)}
                    </pre>
                  )}
                  {msg.pendingAction.preview.sample.length > 0 && (
                    <details className="mt-2 text-slate-300">
                      <summary className="cursor-pointer">عرض عينة السجلات المتأثرة</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-2 text-[10px]">
                        {JSON.stringify(msg.pendingAction.preview.sample, null, 2)}
                      </pre>
                    </details>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => confirmDatabaseAction(msg)}
                      disabled={isLoading}
                      className={`flex-1 rounded-lg px-3 py-2 font-bold text-white disabled:opacity-50 ${
                        msg.pendingAction.preview.operation === "delete"
                          ? "bg-rose-700 hover:bg-rose-600"
                          : "bg-emerald-700 hover:bg-emerald-600"
                      }`}
                    >
                      {msg.pendingAction.preview.operation === "delete"
                        ? "تأكيد الحذف"
                        : "تأكيد التغيير"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelDatabaseAction(msg)}
                      disabled={isLoading}
                      className="rounded-lg border border-slate-700 px-3 py-2 font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}

              {/* بطاقة الطلب المثبت بنجاح */}
              {msg.action === "create_order" && msg.orderNumber && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-xs sm:text-sm text-slate-300 space-y-2.5">
                  <div className="flex items-center justify-between font-bold text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      طلب مثبت في Supabase #{msg.orderNumber}
                    </span>
                    <Link
                      href="/abo1stor3hlaa2kbr8-47/orders/tracking"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium transition flex items-center gap-1"
                    >
                      تتبع الطلبات ↗
                    </Link>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    تم حفظ الطلب وإسناد الرقم التسلسلي في قاعدة البيانات بنجاح.
                  </div>
                </div>
              )}

              {/* استمارة إدخال الطلب المخصصة حسب النوع بدقة */}
              {msg.needType && (
                <div className="mt-3 p-3.5 rounded-xl bg-slate-950/95 border border-amber-500/40 space-y-3.5">
                  <div className="text-xs font-bold text-amber-400 flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-400" />
                      اختر نوع الطلب وأدخل معلوماته المطلوبة:
                    </span>
                    <Link
                      href="/abo1stor3hlaa2kbr8-47/orders/new"
                      target="_blank"
                      className="text-[11px] text-slate-400 hover:text-white underline flex items-center gap-1"
                    >
                      لوحة التحكم <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {/* أزرار اختيار نوع الطلب الأربعة */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategory(c.id);
                          setActiveFormMsgId(msg.id);
                        }}
                        className={`p-2 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center gap-0.5 border ${
                          category === c.id
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md font-black"
                            : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <span className="text-sm">{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* الحقول المخصصة لكل نوع بالضبط */}
                  <div className="space-y-2.5 pt-1">
                    {/* 1. حقول طلب وجهة واحدة */}
                    {category === "single" && (
                      <>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="رقم هاتف الزبون *"
                            value={formData.customerPhone}
                            onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="المنطقة *"
                              value={formData.regionName}
                              onChange={(e) => setFormData({ ...formData, regionName: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative">
                            <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="نوع الطلب (توصيل عادي، استبدال...)"
                              value={formData.orderType}
                              onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="number"
                              placeholder="سعر الطلب (د.ع)"
                              value={formData.totalAmount}
                              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative">
                            <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="وقت الطلب (فوري، العصر...)"
                              value={formData.orderTime}
                              onChange={(e) => setFormData({ ...formData, orderTime: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 2. حقول طلب وجهتين */}
                    {category === "double" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="w-4 h-4 text-amber-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="رقم المرسل *"
                              value={formData.senderPhone}
                              onChange={(e) => setFormData({ ...formData, senderPhone: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative">
                            <MapPin className="w-4 h-4 text-amber-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="منطقة المرسل *"
                              value={formData.senderRegionName}
                              onChange={(e) => setFormData({ ...formData, senderRegionName: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="w-4 h-4 text-indigo-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="رقم المستلم *"
                              value={formData.receiverPhone}
                              onChange={(e) => setFormData({ ...formData, receiverPhone: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div className="relative">
                            <MapPin className="w-4 h-4 text-indigo-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="منطقة المستلم *"
                              value={formData.receiverRegionName}
                              onChange={(e) => setFormData({ ...formData, receiverRegionName: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="relative col-span-1">
                            <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="نوع الطلب"
                              value={formData.orderType}
                              onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative col-span-1">
                            <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="number"
                              placeholder="السعر"
                              value={formData.totalAmount}
                              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative col-span-1">
                            <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="وقت الطلب"
                              value={formData.orderTime}
                              onChange={(e) => setFormData({ ...formData, orderTime: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 3. حقول طلب من محل */}
                    {category === "shop" && (
                      <>
                        <div className="relative">
                          <Store className="w-4 h-4 text-emerald-400 absolute right-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="اسم المحل أو البيج *"
                            value={formData.shopName}
                            onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="رقم هاتف الزبون *"
                              value={formData.customerPhone}
                              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="المنطقة *"
                              value={formData.regionName}
                              onChange={(e) => setFormData({ ...formData, regionName: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="relative col-span-1">
                            <Layers className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="نوع الطلب"
                              value={formData.orderType}
                              onChange={(e) => setFormData({ ...formData, orderType: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative col-span-1">
                            <DollarSign className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="number"
                              placeholder="السعر (د.ع)"
                              value={formData.totalAmount}
                              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>

                          <div className="relative col-span-1">
                            <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="وقت الطلب"
                              value={formData.orderTime}
                              onChange={(e) => setFormData({ ...formData, orderTime: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-2 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 4. حقول طلب تجهيز */}
                    {category === "prep" && (
                      <>
                        <div className="relative">
                          <textarea
                            rows={3}
                            placeholder="اكتب هنا رسالة الطلب وقائمة المواد والمنتجات بالتفصيل... *"
                            value={formData.prepText}
                            onChange={(e) => setFormData({ ...formData, prepText: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="رقم الهاتف (اختياري)"
                              value={formData.customerPhone}
                              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                            />
                          </div>

                          <div className="relative">
                            <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                            <input
                              type="text"
                              placeholder="وقت الطلب (فوري، اليوم...)"
                              value={formData.orderTime}
                              onChange={(e) => setFormData({ ...formData, orderTime: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* أوقات سريعة للاختيار المباشر */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-[11px] text-slate-400">
                      <span className="shrink-0 text-slate-500">وقت سريع:</span>
                      {TIME_PRESETS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setFormData({ ...formData, orderTime: t })}
                          className={`px-2 py-0.5 rounded-lg border text-[10px] transition shrink-0 ${
                            formData.orderTime === t
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* زر التثبيت في Supabase */}
                  <button
                    type="button"
                    onClick={handleQuickOrderSubmit}
                    disabled={isSubmittingOrder}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmittingOrder ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ في Supabase...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تثبيت الطلب في قاعدة البيانات فوراً 🚀</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-900 border border-slate-800 p-3 rounded-2xl w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>الوكيل المستكشف ينفذ الأمر في Supabase...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* أزرار اقتراحات سريعة */}
      <div className="px-4 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => handleSendMessage("سويلي طلب")}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1.5 transition"
        >
          <Package className="w-3.5 h-3.5 text-emerald-400" />
          سويلي طلب
        </button>
        <button
          onClick={() => handleSendMessage("شنو وضع الطلبات اليوم؟")}
          className="text-xs px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700/60 whitespace-nowrap flex items-center gap-1.5 transition"
        >
          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
          ملخص الطلبات
        </button>
      </div>

      {/* حقل الإدخال وزر الصوت والإرسال */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
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
