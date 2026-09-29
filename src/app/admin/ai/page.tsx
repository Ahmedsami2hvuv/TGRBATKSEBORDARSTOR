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
  type?: "text" | "type_selection" | "preparer_selection" | "area_suggestions" | "shop_suggestions" | "summary";
  suggestions?: string[];
  shopSuggestions?: Array<{ id: string; name: string; regionName?: string }>;
  editableText?: string;
};

type OrderDraft = {
  orderType?: string;
  shopName?: string;
  senderPhone?: string;
  senderArea?: string;
  receiverPhone?: string;
  receiverArea?: string;
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
      text: "يا هلا ومية هلا بيك يا أبو الأكبر! المساعد الذكي الخارق في خدمتك 🚀\nتگدر تسألني، تصفر حساب مندوب، تسند طلب، تكول 'سويلي طلب'، أو تدزلي طلب من محل أو وجهتين (برسالة وحدة أو خطوة بخطوة)!",
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
    | "idle"
    | "awaiting_type"
    | "awaiting_shop_name"
    | "awaiting_phone"
    | "awaiting_area"
    | "awaiting_two_way_sender_phone"
    | "awaiting_two_way_sender_area"
    | "awaiting_two_way_receiver_phone"
    | "awaiting_two_way_receiver_area"
    | "awaiting_prep_details"
    | "awaiting_prep_area"
    | "awaiting_price"
    | "awaiting_items"
    | "awaiting_preparers"
    | "awaiting_landmark"
    | "awaiting_time"
  >("idle");
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({});
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([]);
  const [shopSuggestions, setShopSuggestions] = useState<Array<{ id: string; name: string; regionName?: string }>>([]);
  
  // قائمة المجهزين والموردين المتاحين
  const [availablePreparers, setAvailablePreparers] = useState<Array<{ id: string; name: string; phone?: string; type?: string }>>([]);
  const [selectedPreparersMap, setSelectedPreparersMap] = useState<{ [key: string]: boolean }>({});

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  // جلب المجهزين عند بدء التشغيل
  const loadPreparersAndSuppliers = async () => {
    try {
      const res = await fetch("/api/preparers-and-suppliers");
      const data = await res.json();
      const list: Array<{ id: string; name: string; phone?: string; type?: string }> = [
        ...(data.preparers || []).map((p: any) => ({ ...p, type: "preparer" })),
        ...(data.suppliers || []).map((s: any) => ({ ...s, type: "supplier" }))
      ];
      setAvailablePreparers(list);
    } catch (e) {
      console.error("Failed to load preparers and suppliers:", e);
    }
  };

  useEffect(() => {
    loadPreparersAndSuppliers();
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, areaSuggestions, shopSuggestions, wizardStep]);

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
        
        if ((wizardStep === "awaiting_area" || wizardStep === "awaiting_two_way_sender_area" || wizardStep === "awaiting_two_way_receiver_area") && transcript.trim().length > 1) {
          fetchAreaSuggestions(transcript.trim());
        }
        if (wizardStep === "awaiting_shop_name" && transcript.trim().length > 1) {
          fetchShopSuggestions(transcript.trim());
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

  // جلب اقتراحات المحلات
  const fetchShopSuggestions = async (query: string) => {
    try {
      const res = await fetch(`/api/shops/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.shops && Array.isArray(data.shops)) {
        setShopSuggestions(data.shops);
      }
    } catch (e) {}
  };

  // إرسال طلب مكتمل للباك إند
  const submitCompletedOrder = async (draftToSubmit: OrderDraft, currentTime: string) => {
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "انشاء طلب مكتمل", stepData: draftToSubmit })
      });
      const data = await res.json();
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = data.message || "تم إنشاء وتثبيت الطلب بنجاح ✅";
      
      let summaryContent = "";
      if (draftToSubmit.orderType === "وجهتين") {
        summaryContent = `• نوع الطلب: وجهتين\n• هاتف المرسل: ${draftToSubmit.senderPhone}\n• منطقة المرسل: ${draftToSubmit.senderArea}\n• هاتف المستلم: ${draftToSubmit.receiverPhone}\n• منطقة المستلم: ${draftToSubmit.receiverArea}\n• سعر المواد: ${draftToSubmit.price} د.ع\n• وقت الطلب: ${draftToSubmit.deliveryTime || "فوري"}`;
      } else if (draftToSubmit.orderType === "من محل") {
        summaryContent = `• نوع الطلب: من محل (${draftToSubmit.shopName || "عام"})\n• رقم الهاتف: ${draftToSubmit.customerPhone}\n• المنطقة: ${draftToSubmit.area}\n• سعر المواد: ${draftToSubmit.price} د.ع\n• وقت الطلب: ${draftToSubmit.deliveryTime || "فوري"}`;
      } else {
        summaryContent = `• النوع: ${draftToSubmit.orderType || "من الإدارة"}\n• رقم الهاتف: ${draftToSubmit.customerPhone}\n• المنطقة: ${draftToSubmit.area}\n• سعر المواد: ${draftToSubmit.price} د.ع\n• وقت الطلب: ${draftToSubmit.deliveryTime || "فوري"}`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: `🎉 **${reply}**\n\n📋 **ملخص الطلب:**\n${summaryContent}`,
          timestamp: currentTime
        }
      ]);
      speak(reply);
      setWizardStep("idle");
      setOrderDraft({});
      setSelectedPreparersMap({});
      setAreaSuggestions([]);
      setShopSuggestions([]);
    } catch (err) {
      setIsLoading(false);
      isSendingRef.current = false;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: "⚠️ تعذر إكمال إنشاء الطلب بالسيرفر.", timestamp: currentTime }
      ]);
    }
  };

  // معالجة اختيار نوع الطلب (الأزرار الأربعة)
  const handleSelectOrderType = (type: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: `نوع الطلب: ${type}`,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };

    if (type === "من محل") {
      setOrderDraft(prev => ({ ...prev, orderType: "من محل" }));
      setWizardStep("awaiting_shop_name");
      const reply = "تمام يا أبو الأكبر! اخترنا **طلب من محل** 🏬\nأولاً: اكتب **اسم المحل** المطلوب:";
      setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
      speak("تمام يا أبو الأكبر! اخترنا طلب من محل. اكتب اسم المحل المطلوب");
      fetchShopSuggestions("");
      return;
    }

    if (type === "وجهتين") {
      // إعداد طلب الوجهتين
      const updatedDraft: OrderDraft = {
        ...orderDraft,
        orderType: "وجهتين",
        senderPhone: orderDraft.senderPhone || orderDraft.customerPhone || "",
        senderArea: orderDraft.senderArea || orderDraft.area || ""
      };
      setOrderDraft(updatedDraft);

      // فحص الحقل المفقود التالي:
      if (!updatedDraft.senderPhone) {
        setWizardStep("awaiting_two_way_sender_phone");
        const reply = "تمام يا أبو الأكبر! اخترنا **طلب وجهتين** 🔄\nأولاً: انطيني **رقم هاتف المرسل (نقطة الاستلام)**:";
        setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
        speak("تمام يا أبو الأكبر! اخترنا طلب وجهتين. انطيني رقم هاتف المرسل");
        return;
      }

      if (!updatedDraft.senderArea) {
        setWizardStep("awaiting_two_way_sender_area");
        const reply = `سجلت هاتف المرسل: ${updatedDraft.senderPhone} 📱\nهسه انطيني **منطقة المرسل (نقطة الاستلام)**:`;
        setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
        speak("هسه انطيني منطقة المرسل");
        fetchAreaSuggestions("");
        return;
      }

      if (!updatedDraft.receiverPhone) {
        setWizardStep("awaiting_two_way_receiver_phone");
        const reply = `سجلت المرسل: ${updatedDraft.senderPhone} (${updatedDraft.senderArea}) 👍\nهسه انطيني **رقم هاتف المستلم (نقطة التسليم)**:`;
        setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
        speak("هسه انطيني رقم هاتف المستلم");
        return;
      }

      if (!updatedDraft.receiverArea) {
        setWizardStep("awaiting_two_way_receiver_area");
        const reply = `سجلت هاتف المستلم: ${updatedDraft.receiverPhone} 📱\nهسه انطيني **منطقة المستلم (نقطة التسليم)**:`;
        setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
        speak("هسه انطيني منطقة المستلم");
        fetchAreaSuggestions("");
        return;
      }

      setWizardStep("awaiting_price");
      const reply = "سجلت بيانات المرسل والمستلم 👍\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)**:";
      setMessages(prev => [...prev, userMsg, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: userMsg.timestamp }]);
      speak("هسه انطيني سعر الطلب بدون التوصيل");
      return;
    }

    if (type === "تجهيز طلب" || type === "تجهيز") {
      setOrderDraft(prev => ({ ...prev, orderType: "تجهيز طلب" }));
      setWizardStep("awaiting_prep_details");
      loadPreparersAndSuppliers();
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: `تمام يا أبو الأكبر! اخترنا **طلب تجهيز** 📦\nأرسل لي رسالة تحتوي على تفاصيل الطلب:\n• رقم هاتف الزبون\n• منطقة الزبون\n• وباقي الأسطر للمنتجات والمواد المطلوبة (كل مادة بسطر عبر Enter):`,
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, userMsg, aiMsg]);
      speak("تمام يا أبو الأكبر! اخترنا طلب تجهيز. دزلي رسالة بيها هاتف ومنطقة الزبون وقائمة المواد المطلوبة");
      return;
    }

    setOrderDraft(prev => ({ ...prev, orderType: type }));
    setWizardStep("awaiting_price");
    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: "ai",
      text: `سجلت نوع الطلب (${type}) 📝\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)** (مثلاً: 10 أو 10000):`,
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    speak(`سجلت نوع الطلب. هسه انطيني سعر الطلب بدون التوصيل`);
  };


  // تأكيد واختيار المجهزين والانتقال لخطوة السعر
  const handleConfirmPreparersAndProceed = () => {
    const selectedNames = Object.keys(selectedPreparersMap).filter(k => selectedPreparersMap[k]);
    setOrderDraft(prev => ({
      ...prev,
      selectedPreparers: selectedNames.length > 0 ? selectedNames : ["المتجر الرئيسي"]
    }));

    setWizardStep("awaiting_price");
    const currentTime = new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

    const reply = `عاشت إيدك! تم تحديد المجهزين بنجاح 👍\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)** (مثلاً: 10 أو 10000):`;
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        sender: "ai",
        text: reply,
        timestamp: currentTime
      }
    ]);
    speak("تم تحديد المجهزين. هسه انطيني سعر الطلب بدون التوصيل");
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

    // فحص الرسائل متعددة الأسطر لطلب التجهيز المباشر
    const lines = clean.split("\n").map(l => l.trim()).filter(Boolean);

    // 1. فحص طلب وجهتين مسبق أو حالي أو بدء طلب وجهتين
    const isTwoWayTrigger = clean.includes("وجهتين") || clean.includes("وجهين") || clean.includes("استلام وتسليم") || clean.includes("طلب وجهتين");
    const isCurrentTwoWay = orderDraft.orderType === "وجهتين" || wizardStep.startsWith("awaiting_two_way_") || isTwoWayTrigger;

    if (isCurrentTwoWay) {
      let currentDraft: OrderDraft = {
        ...orderDraft,
        orderType: "وجهتين"
      };

      // استخراج أرقام الهواتف
      const allPhones = clean.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/g) || [];
      if (allPhones.length >= 2) {
        currentDraft.senderPhone = currentDraft.senderPhone || allPhones[0];
        currentDraft.receiverPhone = currentDraft.receiverPhone || allPhones[1];
      } else if (allPhones.length === 1) {
        if (!currentDraft.senderPhone || wizardStep === "awaiting_two_way_sender_phone") {
          currentDraft.senderPhone = allPhones[0];
        } else if (!currentDraft.receiverPhone || wizardStep === "awaiting_two_way_receiver_phone") {
          currentDraft.receiverPhone = allPhones[0];
        }
      }

      // إزالة الهواتف من النص للبحث عن المناطق والأسعار
      let cleanText = clean;
      allPhones.forEach(p => {
        cleanText = cleanText.replace(p, " ");
      });

      // استخراج السعر إذا وجد
      const priceMatch = cleanText.match(/(?:سعر|مبلغ|حساب|بـ|ب|بقيمة)?\s*(\d{1,6})\s*(?:الف|ألف|د\.ع|دينار|دع)?/);
      if (priceMatch && !currentDraft.price) {
        const numVal = parseInt(priceMatch[1]);
        if (numVal > 0 && numVal <= 500000 && !allPhones.some(p => p.includes(priceMatch[1]))) {
          if (wizardStep === "awaiting_price" || cleanText.includes("سعر") || cleanText.includes("مبلغ") || cleanText.includes("الف") || cleanText.includes("د")) {
            currentDraft.price = String(numVal);
            cleanText = cleanText.replace(priceMatch[0], " ");
          }
        }
      }

      // استخراج الوقت إذا وجد
      if (cleanText.includes("فوري") || cleanText.includes("هسه") || cleanText.includes("عاجل")) {
        currentDraft.deliveryTime = "فوري";
      } else if (cleanText.includes("العصر") || cleanText.includes("عصر")) {
        currentDraft.deliveryTime = "العصر";
      } else if (cleanText.includes("المغرب") || cleanText.includes("مغرب")) {
        currentDraft.deliveryTime = "المغرب";
      } else if (cleanText.includes("باجر") || cleanText.includes("غدا") || cleanText.includes("غداً")) {
        currentDraft.deliveryTime = "باجر";
      }

      // معالجة المنطقة المدخلة
      const remainingClean = cleanText
        .replace(/^(المرسل|المستلم|منطقة المرسل|منطقة المستلم|المنطقة|منطقة|عنوان|العنوان|الى|إلى|من|السعر|سعر|الوقت|وقت)\s*[:：-]?\s*/g, "")
        .replace(/(وجهتين|طلب|جديد|سويلي|اريد)/g, "")
        .trim();

      if (wizardStep === "awaiting_two_way_sender_area" || (!currentDraft.senderArea && remainingClean.length >= 2 && !/^\d+$/.test(remainingClean))) {
        // فحص المنطقة
        try {
          const res = await fetch(`/api/areas/search?q=${encodeURIComponent(remainingClean)}`);
          const data = await res.json();
          const matched: string[] = data.areas || [];

          if (matched.length > 1 && remainingClean.split(" ").length === 1 && !matched.some(m => m === remainingClean)) {
            setOrderDraft(currentDraft);
            setAreaSuggestions(matched);
            setWizardStep("awaiting_two_way_sender_area");
            setIsLoading(false);
            isSendingRef.current = false;

            const reply = `لقيت عدة مناطق تطابق **${remainingClean}** لمنطقة المرسل 📍\nأي منطقة منها تقصد؟`;
            setMessages(prev => [
              ...prev,
              { id: (Date.now() + 1).toString(), sender: "ai", text: reply, type: "area_suggestions", suggestions: matched, timestamp: currentTime }
            ]);
            speak(reply);
            return;
          }
          currentDraft.senderArea = matched[0] || remainingClean;
        } catch (e) {
          currentDraft.senderArea = remainingClean;
        }
      } else if (wizardStep === "awaiting_two_way_receiver_area" || (!currentDraft.receiverArea && currentDraft.senderArea && remainingClean.length >= 2 && !/^\d+$/.test(remainingClean) && remainingClean !== currentDraft.senderArea)) {
        try {
          const res = await fetch(`/api/areas/search?q=${encodeURIComponent(remainingClean)}`);
          const data = await res.json();
          const matched: string[] = data.areas || [];

          if (matched.length > 1 && remainingClean.split(" ").length === 1 && !matched.some(m => m === remainingClean)) {
            setOrderDraft(currentDraft);
            setAreaSuggestions(matched);
            setWizardStep("awaiting_two_way_receiver_area");
            setIsLoading(false);
            isSendingRef.current = false;

            const reply = `لقيت عدة مناطق تطابق **${remainingClean}** لمنطقة المستلم 📍\nأي منطقة منها تقصد؟`;
            setMessages(prev => [
              ...prev,
              { id: (Date.now() + 1).toString(), sender: "ai", text: reply, type: "area_suggestions", suggestions: matched, timestamp: currentTime }
            ]);
            speak(reply);
            return;
          }
          currentDraft.receiverArea = matched[0] || remainingClean;
        } catch (e) {
          currentDraft.receiverArea = remainingClean;
        }
      }

      setOrderDraft(currentDraft);

      // التحقق من الحقول المتبقية لطلب الوجهتين:
      // 1. رقم هاتف المرسل
      if (!currentDraft.senderPhone) {
        setWizardStep("awaiting_two_way_sender_phone");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = "طلب وجهتين 🔄\nأولاً: انطيني **رقم هاتف المرسل (نقطة الاستلام)**:";
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("طلب وجهتين، انطيني رقم هاتف المرسل");
        return;
      }

      // 2. منطقة المرسل
      if (!currentDraft.senderArea) {
        setWizardStep("awaiting_two_way_sender_area");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت هاتف المرسل: ${currentDraft.senderPhone} 📱\nهسه انطيني **منطقة المرسل (نقطة الاستلام)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني منطقة المرسل");
        fetchAreaSuggestions("");
        return;
      }

      // 3. رقم هاتف المستلم
      if (!currentDraft.receiverPhone) {
        setWizardStep("awaiting_two_way_receiver_phone");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت المرسل: ${currentDraft.senderPhone} (${currentDraft.senderArea}) 👍\nهسه انطيني **رقم هاتف المستلم (نقطة التسليم)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني رقم هاتف المستلم");
        return;
      }

      // 4. منطقة المستلم
      if (!currentDraft.receiverArea) {
        setWizardStep("awaiting_two_way_receiver_area");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت هاتف المستلم: ${currentDraft.receiverPhone} 📱\nهسه انطيني **منطقة المستلم (نقطة التسليم)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني منطقة المستلم");
        fetchAreaSuggestions("");
        return;
      }

      // 5. سعر الطلب
      if (!currentDraft.price) {
        setWizardStep("awaiting_price");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت بيانات المرسل والمستلم:\n• المرسل: ${currentDraft.senderPhone} (${currentDraft.senderArea})\n• المستلم: ${currentDraft.receiverPhone} (${currentDraft.receiverArea})\n\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني سعر الطلب بدون التوصيل");
        return;
      }

      // 6. وقت الطلب
      if (!currentDraft.deliveryTime) {
        setWizardStep("awaiting_time");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت السعر: ${currentDraft.price} د.ع 💰\nشوكت **وقت الطلب أو الملاحظة**؟ (مثلاً: فوري، هسه، العصر):`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("شوكت وقت الطلب أو الملاحظة؟");
        return;
      }

      // إذا اكتملت جميع البيانات، يتم إرسال وتثبيت الطلب فوراً!
      await submitCompletedOrder(currentDraft, currentTime);
      return;
    }

    // 2. فحص مسار "طلب من محل"
    const isShopTrigger = clean.includes("من محل") || clean.includes("طلب محل") || clean.includes("محل ");
    const isCurrentShopOrder = orderDraft.orderType === "من محل" || wizardStep === "awaiting_shop_name" || isShopTrigger;

    if (isCurrentShopOrder) {
      let currentDraft: OrderDraft = {
        ...orderDraft,
        orderType: "من محل"
      };

      // إذا كنا في خطوة انتظار اسم المحل أو الرسالة تحتوي على اسم محل
      if (wizardStep === "awaiting_shop_name" || (!currentDraft.shopName && isShopTrigger)) {
        let shopQuery = clean.replace(/^(طلب\s*)?(من\s*)?محل\s*[:：-]?\s*/, "").replace(/(طلب|جديد|سويلي|اريد)/g, "").trim();
        
        // فحص الهواتف واستخراجها أولاً حتى لا تختلط مع اسم المحل
        const phonesInMsg = shopQuery.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/g) || [];
        if (phonesInMsg.length > 0) {
          currentDraft.customerPhone = phonesInMsg[0];
          phonesInMsg.forEach(p => {
            shopQuery = shopQuery.replace(p, " ");
          });
        }

        // فحص السعر
        const priceMatch = shopQuery.match(/(?:سعر|مبلغ|حساب|بـ|ب|بقيمة)?\s*(\d{1,6})\s*(?:الف|ألف|د\.ع|دينار|دع)?/);
        if (priceMatch) {
          const numVal = parseInt(priceMatch[1]);
          if (numVal > 0 && numVal <= 500000 && !phonesInMsg.some(p => p.includes(priceMatch[1]))) {
            currentDraft.price = String(numVal);
            shopQuery = shopQuery.replace(priceMatch[0], " ");
          }
        }

        // فحص الوقت
        if (shopQuery.includes("فوري") || shopQuery.includes("هسه") || shopQuery.includes("عاجل")) {
          currentDraft.deliveryTime = "فوري";
        } else if (shopQuery.includes("العصر") || shopQuery.includes("عصر")) {
          currentDraft.deliveryTime = "العصر";
        }

        shopQuery = shopQuery.trim();

        if (shopQuery.length > 0) {
          try {
            const res = await fetch(`/api/shops/search?q=${encodeURIComponent(shopQuery)}`);
            const data = await res.json();
            const matchedShops: Array<{ id: string; name: string; regionName?: string }> = data.shops || [];

            // إذا وجدنا محلات مشابهة وكان الاسم لم يتم النقر عليه كخيار مؤكد
            const exactShop = matchedShops.find(s => s.name.trim() === shopQuery);
            if (matchedShops.length > 1 && !exactShop) {
              setOrderDraft(currentDraft);
              setShopSuggestions(matchedShops);
              setWizardStep("awaiting_shop_name");
              setIsLoading(false);
              isSendingRef.current = false;

              const reply = `لقيت عدة محلات قريبة تطابق **${shopQuery}** 🏬\nاختر المحل المطلوب مباشرة من الأزرار أدناه:`;
              setMessages(prev => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  sender: "ai",
                  text: reply,
                  type: "shop_suggestions",
                  shopSuggestions: matchedShops,
                  timestamp: currentTime
                }
              ]);
              speak(`لقيت عدة محلات، اختر المحل المطلوب`);
              return;
            } else if (matchedShops.length >= 1) {
              currentDraft.shopName = exactShop ? exactShop.name : matchedShops[0].name;
            } else {
              currentDraft.shopName = shopQuery;
            }
          } catch (e) {
            currentDraft.shopName = shopQuery;
          }
        }
      }

      // فحص أرقام الهواتف والمناطق المتبقية لطلب المحل
      const phoneMatch = clean.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/);
      if (phoneMatch && !currentDraft.customerPhone) {
        currentDraft.customerPhone = phoneMatch[0];
      }

      setOrderDraft(currentDraft);

      // التحقق من الحقول المتبقية لطلب من محل:
      // 1. اسم المحل
      if (!currentDraft.shopName) {
        setWizardStep("awaiting_shop_name");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = "طلب من محل 🏬\nأولاً: اكتب **اسم المحل** المطلوب:";
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("طلب من محل، اكتب اسم المحل المطلوب");
        fetchShopSuggestions("");
        return;
      }

      // 2. رقم هاتف الزبون
      if (!currentDraft.customerPhone) {
        setWizardStep("awaiting_phone");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت المحل: ${currentDraft.shopName} 🏬\nهسه انطيني **رقم هاتف الزبون** (ضروري):`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني رقم هاتف الزبون");
        return;
      }

      // 3. منطقة الزبون
      if (!currentDraft.area) {
        setWizardStep("awaiting_area");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت الهاتف: ${currentDraft.customerPhone} 📱\nهسه انطيني **منطقة الزبون** (مثلاً: جيكور، نهر خوز، محيلة):`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني منطقة الزبون");
        fetchAreaSuggestions("");
        return;
      }

      // 4. سعر الطلب
      if (!currentDraft.price) {
        setWizardStep("awaiting_price");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت المنطقة: ${currentDraft.area} 📍\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني سعر الطلب بدون التوصيل");
        return;
      }

      // 5. وقت الطلب
      if (!currentDraft.deliveryTime) {
        setWizardStep("awaiting_time");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت السعر: ${currentDraft.price} د.ع 💰\nشوكت **وقت الطلب أو الملاحظة**؟ (مثلاً: فوري، هسه، العصر):`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("شوكت وقت الطلب أو الملاحظة؟");
        return;
      }

      // اكتمال كل بيانات طلب من محل
      await submitCompletedOrder(currentDraft, currentTime);
      return;
    }

    // 3. فحص مسار "طلب تجهيز"
    const isPrepTrigger = clean.includes("تجهيز") || clean.includes("طلب تجهيز") || clean.includes("تجهيز طلب") || wizardStep === "awaiting_prep_details" || wizardStep === "awaiting_prep_area" || orderDraft.orderType === "تجهيز طلب";

    if (isPrepTrigger && (wizardStep === "awaiting_prep_details" || wizardStep === "awaiting_prep_area" || clean.includes("تجهيز") || lines.length >= 2)) {
      let currentDraft: OrderDraft = {
        ...orderDraft,
        orderType: "تجهيز طلب"
      };

      // إذا كنا في خطوة اختيار/تأكيد المنطقة المحددة لطلب التجهيز
      if (wizardStep === "awaiting_prep_area") {
        const areaText = clean.replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "").replace("هل تقصد: ", "").replace("؟", "").trim();
        
        try {
          const res = await fetch(`/api/areas/search?q=${encodeURIComponent(areaText)}`);
          const data = await res.json();
          const matchedAreas: string[] = data.areas || [];

          const exactMatch = matchedAreas.find(a => a === areaText);
          if (matchedAreas.length > 1 && (!exactMatch || (matchedAreas.length > 1 && areaText.split(" ").length === 1))) {
            setAreaSuggestions(matchedAreas);
            setIsLoading(false);
            isSendingRef.current = false;

            const reply = `لقيت عدة مناطق تطابق **${areaText}** 📍\nأي منطقة منها تقصد يا أبو الأكبر؟ (اختر من الأزرار أدناه):`;
            setMessages(prev => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                sender: "ai",
                text: reply,
                type: "area_suggestions",
                suggestions: matchedAreas,
                timestamp: currentTime
              }
            ]);
            speak(`لقيت عدة مناطق، أي منطقة منها تقصد؟`);
            return;
          }
          currentDraft.area = matchedAreas[0] || areaText;
        } catch (e) {
          currentDraft.area = areaText;
        }

        setOrderDraft(currentDraft);
        setAreaSuggestions([]);
        setWizardStep("awaiting_preparers");
        loadPreparersAndSuppliers();
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `سجلت المنطقة: ${currentDraft.area} 📍\nالهاتف: ${currentDraft.customerPhone || "غير محدد"} 📱\nالمواد (${currentDraft.items?.length || 0}): ${(currentDraft.items || []).join(" ، ")} 🛒\n\nيرجى تحديد المجهزين والموردين من القائمة أدناه ثم النقر على **التالي**:`;
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
        speak("سجلت المنطقة. يرجى تحديد المجهزين والموردين من القائمة ثم النقر على التالي");
        return;
      }

      // تحليل أسطر رسالة التجهيز
      let extractedPhone = currentDraft.customerPhone || "";
      let extractedArea = currentDraft.area || "";
      const remainingItems: string[] = [];

      // استخراج رقم الهاتف
      const allPhones = clean.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/g) || [];
      if (allPhones.length > 0) {
        extractedPhone = allPhones[0];
      }

      // فحص الأسطر للبحث عن المنطقة والمنتجات
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // إذا كان السطر هو رقم الهاتف
        if (allPhones.some(p => line.includes(p))) {
          continue;
        }

        // فحص إذا كان السطر يمثل منطقة صريحة
        if (!extractedArea && (line.startsWith("منطقة") || line.startsWith("المنطقة") || line.startsWith("عنوان") || line.startsWith("العنوان") || line.startsWith("الى ") || line.startsWith("إلى "))) {
          extractedArea = line.replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "").trim();
          continue;
        }

        // فحص إذا كان السطر اسم منطقة معروفة وقصيرة (كلمة أو كلمتين)
        if (!extractedArea && line.length < 25 && !/\d+/.test(line)) {
          try {
            const res = await fetch(`/api/areas/search?q=${encodeURIComponent(line)}`);
            const data = await res.json();
            const matchedAreas: string[] = data.areas || [];
            if (matchedAreas.length > 0) {
              extractedArea = line;
              continue;
            }
          } catch (e) {}
        }

        // ما تبقى يعتبر مادة/منتج
        remainingItems.push(line.replace(/^[-*•\d+.)]\s*/, ""));
      }

      currentDraft.customerPhone = extractedPhone;
      currentDraft.items = remainingItems.length > 0 ? remainingItems : (currentDraft.items || ["طلب عام"]);

      // التحقق من صحة ودقة المنطقة:
      if (extractedArea) {
        try {
          const res = await fetch(`/api/areas/search?q=${encodeURIComponent(extractedArea)}`);
          const data = await res.json();
          const matchedAreas: string[] = data.areas || [];

          // إذا كانت هناك خيارات متعددة للمنطقة (مثل جيكور) أو اسم غير مؤكد
          const exactMatch = matchedAreas.find(a => a === extractedArea);
          if (matchedAreas.length > 1 && (!exactMatch || (matchedAreas.length > 1 && extractedArea.split(" ").length === 1))) {
            currentDraft.area = "";
            setOrderDraft(currentDraft);
            setAreaSuggestions(matchedAreas);
            setWizardStep("awaiting_prep_area");
            setIsLoading(false);
            isSendingRef.current = false;

            const reply = `سجلت الهاتف (${extractedPhone || "مسجل"}) والمواد (${currentDraft.items.length}) 👍\nلكيت عدة مناطق تطابق **${extractedArea}** 📍، أي منطقة منها تقصد يا أبو الأكبر؟ (اختر من الأزرار أدناه):`;
            setMessages(prev => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                sender: "ai",
                text: reply,
                type: "area_suggestions",
                suggestions: matchedAreas,
                timestamp: currentTime
              }
            ]);
            speak(`لكيت عدة مناطق، يرجى اختيار المنطقة من الخيارات أدناه`);
            return;
          }
          currentDraft.area = exactMatch || matchedAreas[0] || extractedArea;
        } catch (e) {
          currentDraft.area = extractedArea;
        }
      }

      setOrderDraft(currentDraft);

      // إذا كانت المنطقة مفقودة
      if (!currentDraft.area) {
        setWizardStep("awaiting_prep_area");
        setIsLoading(false);
        isSendingRef.current = false;
        fetchAreaSuggestions("");

        const reply = `سجلت الهاتف (${currentDraft.customerPhone || "مسجل"}) والمواد (${currentDraft.items.length}) 👍\nهسه انطيني **منطقة الزبون** (مثلاً: جيكور، نهر خوز، محيلة):`;
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
        ]);
        speak("هسه انطيني منطقة الزبون");
        return;
      }

      // إذا كانت كل تفاصيل التجهيز مكتملة (الهاتف والمنطقة والمنتجات)، ننتقل مباشرة لاختيار المجهزين!
      setWizardStep("awaiting_preparers");
      loadPreparersAndSuppliers();
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `تم استخراج بيانات طلب التجهيز بنجاح يا أبو الأكبر! 📦\n• الهاتف: ${currentDraft.customerPhone || "07700000000"} 📱\n• المنطقة: ${currentDraft.area} 📍\n• المواد (${currentDraft.items.length}): ${currentDraft.items.join(" ، ")} 🛒\n\nيرجى تحديد المجهزين والموردين من القائمة أدناه ثم النقر على **التالي**:`;
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
      speak("تم استخراج بيانات طلب التجهيز. يرجى تحديد المجهزين والموردين من القائمة ثم النقر على التالي");
      return;
    }

    // فحص ذكي: هل تحتوي الرسالة على رقم هاتف ومنطقة معاً للطلب العادي؟
    const phonePattern = /(07\d{9}|9647\d{9}|\+9647\d{9})/;
    const phoneMatch = clean.match(phonePattern);
    const textWithoutPhone = clean.replace(phonePattern, "").replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "").trim();


    // الخطوة 1: انتظار رقم هاتف الزبون (أو إذا كتب الهاتف والمنطقة معاً)
    if (wizardStep === "awaiting_phone") {
      const extractedPhone = phoneMatch ? phoneMatch[0] : (clean.length >= 10 && /^\d+$/.test(clean) ? clean : "");
      const possibleArea = textWithoutPhone || (lines.length > 1 ? lines[1] : "");

      if (extractedPhone) {
        setOrderDraft(prev => ({ ...prev, customerPhone: extractedPhone }));
        
        // إذا كان كتب المنطقة مع الهاتف في نفس الرسالة
        if (possibleArea && possibleArea.length >= 2 && !/^\d+$/.test(possibleArea)) {
          try {
            const res = await fetch(`/api/areas/search?q=${encodeURIComponent(possibleArea)}`);
            const data = await res.json();
            const matchedAreas: string[] = data.areas || [];

            if (matchedAreas.length > 1) {
              setAreaSuggestions(matchedAreas);
              setWizardStep("awaiting_area");
              setIsLoading(false);
              isSendingRef.current = false;

              const reply = `سجلت الهاتف: ${extractedPhone} 📱\nلقيت عدة مناطق تطابق **${possibleArea}**، يرجى اختيار المنطقة المحددة من الأزرار أدناه:`;
              setMessages(prev => [
                ...prev,
                {
                  id: (Date.now() + 1).toString(),
                  sender: "ai",
                  text: reply,
                  type: "area_suggestions",
                  suggestions: matchedAreas,
                  timestamp: currentTime
                }
              ]);
              speak(`سجلت الهاتف، يرجى اختيار المنطقة من الخيارات المتاحة`);
              return;
            } else if (matchedAreas.length === 1) {
              setOrderDraft(prev => ({ ...prev, area: matchedAreas[0] }));
              setWizardStep("awaiting_type");
              setIsLoading(false);
              isSendingRef.current = false;

              const reply = `سجلت الهاتف: ${extractedPhone} 📱 والمنطقة: ${matchedAreas[0]} 📍\nهسه اختار **نوع الطلب** من الخيارات الأربعة أدناه:`;
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
              speak(`سجلت الهاتف والمنطقة، هسه اختار نوع الطلب`);
              return;
            }
          } catch (e) {}

          setOrderDraft(prev => ({ ...prev, area: possibleArea }));
          setWizardStep("awaiting_type");
          setIsLoading(false);
          isSendingRef.current = false;

          const reply = `سجلت الهاتف: ${extractedPhone} 📱 والمنطقة: ${possibleArea} 📍\nهسه اختار **نوع الطلب** من الخيارات الأربعة أدناه:`;
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
          speak(`سجلت الهاتف والمنطقة، هسه اختار نوع الطلب`);
          return;
        }

        // إذا كتب الهاتف فقط
        setWizardStep("awaiting_area");
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `سجلت رقم الهاتف: ${extractedPhone} 📱\nهسه انطيني **منطقة الزبون** (مثلاً: جيكور، نهر خوز، محيلة):`;
        setMessages(prev => [
          ...prev,
          { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
        ]);
        speak(reply);
        fetchAreaSuggestions("");
        return;
      }
    }

    // الخطوة 2: انتظار منطقة الزبون
    if (wizardStep === "awaiting_area") {
      const areaText = clean.replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "").trim();
      
      try {
        const res = await fetch(`/api/areas/search?q=${encodeURIComponent(areaText)}`);
        const data = await res.json();
        const matchedAreas: string[] = data.areas || [];

        const exactMatch = matchedAreas.find(a => a === areaText);
        if (matchedAreas.length > 1 && (!exactMatch || matchedAreas.length > 1 && areaText.split(" ").length === 1)) {
          setAreaSuggestions(matchedAreas);
          setIsLoading(false);
          isSendingRef.current = false;

          const reply = `لقيت عدة مناطق تطابق **${areaText}** 📍\nأي منطقة منها تقصد يا أبو الأكبر؟ (اختر من الأزرار أدناه):`;
          setMessages(prev => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              sender: "ai",
              text: reply,
              type: "area_suggestions",
              suggestions: matchedAreas,
              timestamp: currentTime
            }
          ]);
          speak(`لقيت عدة مناطق، أي منطقة منها تقصد؟`);
          return;
        }
      } catch (e) {}

      const chosenArea = areaText;
      const updatedDraft = { ...orderDraft, area: chosenArea };
      setOrderDraft(updatedDraft);
      setAreaSuggestions([]);

      if (updatedDraft.orderType === "من محل") {
        setWizardStep("awaiting_price");
        setIsLoading(false);
        isSendingRef.current = false;
        const reply = `سجلت المنطقة: ${chosenArea} 📍\nهسه انطيني **سعر الطلب (مبلغ المواد الصافي بدون التوصيل)**:`;
        setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }]);
        speak("هسه انطيني سعر الطلب بدون التوصيل");
        return;
      }

      setWizardStep("awaiting_type");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `عاشت إيدك! المنطقة: ${chosenArea} 📍\nهسه اختار **نوع الطلب** من الخيارات الأربعة أدناه:`;
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

    // معالجة إدخال قائمة المواد لطلب التجهيز
    if (wizardStep === "awaiting_items") {
      const itemsList = clean.split("\n").map(s => s.trim()).filter(Boolean);
      setOrderDraft(prev => ({ ...prev, items: itemsList }));
      setWizardStep("awaiting_preparers");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `سجلت ${itemsList.length} مواد 🛒\nحدد المجهزين والموردين من القائمة أدناه ثم اضغط **التالي**:`;
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

    // الخطوة 4: انتظار سعر الطلب (مبلغ المواد الصافي)
    if (wizardStep === "awaiting_price") {
      setOrderDraft(prev => ({ ...prev, price: clean }));
      setWizardStep("awaiting_time");
      setIsLoading(false);
      isSendingRef.current = false;

      const reply = `سجلت سعر الطلب: ${clean} د.ع 💰 (سيتم إضافة أجرة التوصيل فوقه تلقائياً)\nآخر متطلب: شوكت **وقت الطلب أو الملاحظة**؟ (مثلاً: فوري، هسه، العصر):`;
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), sender: "ai", text: reply, timestamp: currentTime }
      ]);
      speak(reply);
      return;
    }

    // الخطوة 5: انتظار وقت الطلب أو الملاحظة وإنشاء الطلب
    if (wizardStep === "awaiting_time") {
      const finalDraft: OrderDraft = {
        ...orderDraft,
        deliveryTime: clean
      };
      await submitCompletedOrder(finalDraft, currentTime);
      return;
    }

    // فحص ما إذا كتب "سويلي طلب" أو "طلب جديد"
    if (clean.includes("سويلي طلب") || clean.includes("سوي طلب") || clean.includes("طلب جديد") || clean.includes("سويلي اوردر") || clean.includes("انشاء طلب")) {
      setIsLoading(false);
      isSendingRef.current = false;
      setWizardStep("awaiting_phone");
      
      const reply = "تأمرني أمر يا أبو الأكبر! 🚀\nأولاً: انطيني **رقم هاتف الزبون** (ضروري):";
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: reply,
          timestamp: currentTime
        }
      ]);
      speak(reply);
      return;
    }

    // فحص الرسائل متعددة الأسطر لطلب التجهيز المباشر
    if (lines.length >= 2) {
      let extractedPhone = "";
      let extractedArea = "";
      const remainingItems: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const phoneMatch = line.match(/(07\d{9}|9647\d{9}|\+9647\d{9})/);
        if (phoneMatch && !extractedPhone && i < 2) {
          extractedPhone = phoneMatch[0];
        } else if (!extractedArea && i < 2 && !phoneMatch) {
          extractedArea = line.replace(/^(المنطقة|منطقة|عنوان|العنوان|الى|إلى)\s*[:：-]?\s*/, "");
        } else {
          remainingItems.push(line.replace(/^[-*•\d+.)]\s*/, ""));
        }
      }

      if (extractedPhone || extractedArea) {
        setOrderDraft({
          customerPhone: extractedPhone || "07700000000",
          area: extractedArea || "البصرة",
          items: remainingItems.length > 0 ? remainingItems : ["طلب عام"],
          orderType: "تجهيز طلب"
        });
        setWizardStep("awaiting_preparers");
        setIsLoading(false);
        isSendingRef.current = false;

        const reply = `تم استخراج بيانات الطلب بنجاح يا أبو الأكبر! 📦\n• الهاتف: ${extractedPhone || "غير محدد"}\n• المنطقة: ${extractedArea || "البصرة"}\n• المواد (${remainingItems.length}): ${remainingItems.join(" ، ")}\n\nيرجى تحديد المجهزين والموردين من القائمة أدناه ثم النقر على **التالي**:`;
        
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
    }

    // إرسال الأمر العام لمسار AI Agent
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean })
      });
      const data = await res.json();
      setIsLoading(false);
      isSendingRef.current = false;

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
        setWizardStep("awaiting_phone");
        const reply = "تأمرني أمر يا أبو الأكبر! 🚀\nأولاً: انطيني **رقم هاتف الزبون** (ضروري):";
        setMessages(prev => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: reply,
            timestamp: currentTime
          }
        ]);
        speak(reply);
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
    setShopSuggestions([]);
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
      <main ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl w-full mx-auto pb-44">
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

            {/* خيارات المحلات المقترحة كأزرار مباشرة */}
            {msg.type === "shop_suggestions" && msg.shopSuggestions && msg.shopSuggestions.length > 0 && (
              <div className="w-full max-w-[95%] p-3.5 bg-[#121A2B]/90 border border-blue-500/30 rounded-3xl space-y-2.5 shadow-lg animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                  <Store className="w-4 h-4" />
                  <span>انقر على المحل المطلوب لتحديده:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {msg.shopSuggestions.map((shp, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(shp.name)}
                      className="p-3 bg-[#1A2336] hover:bg-blue-600 border border-white/10 hover:border-blue-400/50 rounded-2xl flex items-center justify-between text-right text-xs font-bold text-white transition-all active:scale-95 shadow-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-400 group-hover:text-white shrink-0" />
                        <div>
                          <div className="font-bold">{shp.name}</div>
                          {shp.regionName && <div className="text-[10px] text-white/50 group-hover:text-white/80">{shp.regionName}</div>}
                        </div>
                      </div>
                      <span className="text-[10px] text-blue-300/70 group-hover:text-white">اختيار 👈</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* قائمة المجهزين والموردين بـ Checkboxes وأزرار تحكم سريعة */}
            {msg.type === "preparer_selection" && wizardStep === "awaiting_preparers" && (
              <div className="w-full max-w-[95%] p-4 bg-[#121A2B]/95 border border-emerald-500/40 rounded-3xl space-y-3.5 shadow-xl animate-fadeIn">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <Users className="w-4 h-4" />
                    <span>حدد المجهزين والموردين المطلوبين:</span>
                  </div>
                  
                  {/* أزرار سريعة للتحكم بالاختيار */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        const newMap: { [key: string]: boolean } = {};
                        availablePreparers.forEach(p => { newMap[p.name] = true; });
                        setSelectedPreparersMap(newMap);
                      }}
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-bold border border-emerald-500/30 transition-colors"
                    >
                      تحديد الكل ✅
                    </button>
                    <button
                      onClick={() => setSelectedPreparersMap({})}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[10px] font-bold border border-white/10 transition-colors"
                    >
                      إلغاء ❌
                    </button>
                  </div>
                </div>

                {availablePreparers.length === 0 ? (
                  <div className="py-4 text-center space-y-2">
                    <p className="text-xs text-amber-300 font-bold">جاري تحميل قائمة المجهزين والموردين...</p>
                    <button
                      onClick={loadPreparersAndSuppliers}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/30 transition-colors inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>إعادة التحميل الآن</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {availablePreparers.map(prep => {
                      const isChecked = !!selectedPreparersMap[prep.name];
                      const isSupplier = prep.type === "supplier";
                      return (
                        <button
                          key={prep.id}
                          onClick={() => {
                            setSelectedPreparersMap(prev => ({
                              ...prev,
                              [prep.name]: !prev[prep.name]
                            }));
                          }}
                          className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 transition-all text-right shadow-sm ${
                            isChecked
                              ? isSupplier
                                ? "bg-blue-500/25 border-blue-400 text-blue-200 shadow-blue-500/10"
                                : "bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-emerald-500/10"
                              : "bg-[#1A2336] border-white/5 text-white/70 hover:bg-[#232F4A]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            {isChecked ? (
                              <CheckSquare className={`w-4 h-4 ${isSupplier ? "text-blue-400" : "text-emerald-400"} shrink-0`} />
                            ) : (
                              <Square className="w-4 h-4 text-white/30 shrink-0" />
                            )}
                            <div className="truncate">
                              <div className="truncate font-bold flex items-center gap-1">
                                <span>{isSupplier ? "🏬 مورد:" : "📦 مجهز:"}</span>
                                <span>{prep.name}</span>
                              </div>
                              {prep.phone && (
                                <span className="text-[10px] text-white/40 block">{prep.phone}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-white/40">{isSupplier ? "مورد" : "مجهز"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="pt-2.5 flex items-center justify-between border-t border-white/10">
                  <span className="text-[11px] text-emerald-300 font-bold">
                    المحدد: {Object.values(selectedPreparersMap).filter(Boolean).length} من أصل {availablePreparers.length}
                  </span>
                  <button
                    onClick={handleConfirmPreparersAndProceed}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all"
                  >
                    <span>تأكيد المجهزين والمتابعة</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* خيارات المناطق المقترحة والمتشابهة كأزرار مباشرة */}
            {msg.type === "area_suggestions" && msg.suggestions && msg.suggestions.length > 0 && (
              <div className="w-full max-w-[95%] p-3.5 bg-[#121A2B]/90 border border-sky-500/30 rounded-3xl space-y-2.5 shadow-lg animate-fadeIn">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
                  <MapPin className="w-4 h-4" />
                  <span>انقر على المنطقة المطلوبة مباشرة:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {msg.suggestions.map((areaName, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(areaName)}
                      className="p-3 bg-[#1A2336] hover:bg-sky-600 border border-white/10 hover:border-sky-400/50 rounded-2xl flex items-center justify-between text-right text-xs font-bold text-white transition-all active:scale-95 shadow-sm group"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-sky-400 group-hover:text-white shrink-0" />
                        <span>{areaName}</span>
                      </div>
                      <span className="text-[10px] text-sky-300/70 group-hover:text-white">اختيار 👈</span>
                    </button>
                  ))}
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

        {/* شريط اقتراحات المحلات السريعة */}
        {shopSuggestions.length > 0 && wizardStep === "awaiting_shop_name" && (
          <div className="p-3.5 bg-[#121A2B]/95 border border-blue-400/30 rounded-2xl space-y-2.5 animate-fadeIn shadow-lg">
            <div className="flex items-center gap-1.5 text-xs text-blue-400 font-bold">
              <Store className="w-4 h-4" />
              <span>المحلات المقترحة (انقر للاختيار المباشر):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {shopSuggestions.map((shp, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(shp.name)}
                  className="px-3.5 py-2 bg-[#1A2336] hover:bg-blue-600 hover:text-white border border-white/10 rounded-xl text-xs font-medium text-slate-200 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5 text-blue-400" />
                  <span>{shp.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* شريط اقتراحات المناطق السريعة */}
        {areaSuggestions.length > 0 && (wizardStep === "awaiting_area" || wizardStep === "awaiting_two_way_sender_area" || wizardStep === "awaiting_two_way_receiver_area") && (
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
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          {/* زر الميكروفون */}
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3.5 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
              isListening
                ? "bg-rose-500 text-white animate-bounce shadow-lg shadow-rose-500/40"
                : "bg-white/5 hover:bg-white/10 text-sky-400 border border-white/10"
            }`}
            title={isListening ? "إيقاف الاستماع" : "تحدث بالصوت"}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* حقل الإدخال النصي المتعدد الأسطر (Textarea) */}
          <div className="flex-1 relative">
            <textarea
              rows={Math.min(5, Math.max(1, inputMessage.split("\n").length))}
              value={inputMessage}
              onChange={e => {
                setInputMessage(e.target.value);
                if (wizardStep === "awaiting_shop_name" && e.target.value.trim().length > 0) {
                  fetchShopSuggestions(e.target.value.trim());
                } else if ((wizardStep === "awaiting_area" || wizardStep === "awaiting_two_way_sender_area" || wizardStep === "awaiting_two_way_receiver_area") && e.target.value.trim().length > 0) {
                  fetchAreaSuggestions(e.target.value.trim());
                }
              }}
              onKeyDown={e => {
                // Enter ينزل سطر جديد، و Ctrl+Enter يرسل
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  sendMessage(inputMessage);
                }
              }}
              placeholder={
                wizardStep === "awaiting_shop_name"
                  ? "اكتب اسم المحل (مثال: مشويات البركة)..."
                  : wizardStep === "awaiting_two_way_sender_phone"
                  ? "أدخل رقم هاتف المرسل (نقطة الاستلام)..."
                  : wizardStep === "awaiting_two_way_sender_area"
                  ? "أدخل منطقة المرسل..."
                  : wizardStep === "awaiting_two_way_receiver_phone"
                  ? "أدخل رقم هاتف المستلم (نقطة التسليم)..."
                  : wizardStep === "awaiting_two_way_receiver_area"
                  ? "أدخل منطقة المستلم..."
                  : wizardStep === "awaiting_phone"
                  ? "أدخل رقم هاتف الزبون..."
                  : wizardStep === "awaiting_area"
                  ? "أدخل منطقة الزبون..."
                  : wizardStep === "awaiting_price"
                  ? "أدخل سعر الطلب الصافي (بدون التوصيل)..."
                  : wizardStep === "awaiting_items"
                  ? "اكتب قائمة المواد (كل مادة بسطر عبر Enter)..."
                  : wizardStep === "awaiting_time"
                  ? "أدخل وقت الطلب أو الملاحظة (فوري، العصر)..."
                  : "تحدث أو اكتب أمرك هنا (Enter للسطر الجديد، وزر الإرسال للإرسال)..."
              }
              className="w-full bg-[#121A2B]/90 text-white placeholder-white/40 text-sm px-4 py-3 rounded-2xl border border-white/10 focus:outline-none focus:border-sky-400 transition-colors shadow-inner resize-none max-h-36 overflow-y-auto"
            />
          </div>

          {/* زر الإرسال */}
          <button
            onClick={() => sendMessage(inputMessage)}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-40 text-white rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-lg shadow-sky-500/25 active:scale-95"
            title="إرسال"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}


