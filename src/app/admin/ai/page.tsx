"use client"

import React, { useState, useRef, useEffect } from "react"

interface Message {
  id: string
  sender: "user" | "ai"
  text: string
  options?: string[]
  progress?: number
  action?: string
  status?: "success" | "error" | "info"
  timestamp: string
}

type OrderType = "admin" | "two_way" | "shop"

interface OrderDraft {
  orderTypeTitle?: string
  orderType?: OrderType
  customerPhone?: string
  customerRegionName?: string
  orderSubtype?: string
  price?: string
  orderTime?: string
  senderPhone?: string
  senderRegionName?: string
  shopName?: string
  customerName?: string
}

export default function AdminAiVoiceAgentPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "مرحباً بك يا أبو الأكبر في وكيل الطلبات الفائق بالصوت 🎙️🚀\nيمكنك التحدث بالصوت أو الكتابة:\n• لعمل طلب جديد، قل: «سويلي طلب» أو اضغط على الزر أدناه.\n• لتنفيذ أي أمر مباشر، قل مثلاً: «صفر حساب فارس» أو «اسند طلب 2815 لفارس».",
      options: ["سويلي طلب", "صفر حساب فارس", "اسند طلب 2815 الى فارس", "حالة الطلبات اليوم"],
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ])

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({})
  const [areaSuggestions, setAreaSuggestions] = useState<string[]>([])
  const [metadata, setMetadata] = useState<{ shops: any[]; customers: any[] }>({ shops: [], customers: [] })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  // التمرير التلقائي لأسفل المحادثة
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading, areaSuggestions])

  // جلب المحلات والعملاء للاقتراحات الذكية
  useEffect(() => {
    fetch("/api/ai-agent?type=metadata")
      .then((res) => res.json())
      .then((data) => {
        if (data.shops || data.customers) {
          setMetadata({ shops: data.shops || [], customers: data.customers || [] })
        }
      })
      .catch(() => {})
  }, [])

  // إعداد وتفعيل التعرف الصوتي (Web Speech API)
  const toggleSpeechRecognition = () => {
    if (isRecording) {
      recognitionRef.current?.stop()
      setIsRecording(false)
      return
    }

    const SpeechRecognition =
      (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition

    if (!SpeechRecognition) {
      alert("متصفحك لا يدعم التعرف على الصوت المباشر. يرجى استخدام متصفح Google Chrome.")
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = "ar-IQ" || "ar-SA"
      recognition.continuous = false
      recognition.interimResults = false

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript
        if (transcript) {
          setInput(transcript)
          handleSend(transcript)
        }
        setIsRecording(false)
      }

      recognition.onerror = (e: any) => {
        console.error("Speech error:", e)
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err) {
      console.error(err)
      setIsRecording(false)
    }
  }

  // البحث في API المناطق الذكية عند كتابة أو استدعاء منطقة
  const fetchAreaSuggestions = async (q: string) => {
    try {
      const res = await fetch(`/api/areas/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      const list = [...(data.suggestions || []), ...(data.areas || [])]
      setAreaSuggestions(list.slice(0, 6))
      return list
    } catch (e) {
      return ["نهر خوز", "ابو الخصيب مركز", "البلد", "محيلة", "باب طويل", "جيكور"]
    }
  }

  // إضافة رسالة جديدة للمحادثة
  const addMessage = (msg: Omit<Message, "id" | "timestamp">) => {
    const newMsg: Message = {
      ...msg,
      id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
    setMessages((prev) => [...prev, newMsg])
    return newMsg
  }

  // إلغاء محادثة الطلب الحالية
  const cancelOrderFlow = () => {
    setActiveStep(null)
    setOrderDraft({})
    setAreaSuggestions([])
    addMessage({
      sender: "ai",
      text: "تم إلغاء عملية إنشاء الطلب. كيف أساعدك الآن يا أبو الأكبر؟",
      options: ["سويلي طلب", "صفر حساب فارس", "اسند طلب 2815 الى فارس"]
    })
  }

  // معالجة تدفق خطوات إنشاء الطلب المتعدد
  const handleOrderWizard = async (text: string) => {
    const cleanText = text.trim()
    const draft = { ...orderDraft }

    // الخطوة 0: اختيار نوع الطلب
    if (activeStep === "CHOOSE_TYPE") {
      if (cleanText.includes("1") || cleanText.includes("إدارة") || cleanText.includes("ادارة")) {
        draft.orderType = "admin"
        draft.orderTypeTitle = "طلب من الإدارة"
        setOrderDraft(draft)
        setActiveStep("ADMIN_PHONE")
        addMessage({
          sender: "ai",
          text: "ممتاز! تم اختيار (طلب من الإدارة) 🏢\n\nالخطوة 1 من 5: ما هو رقم هاتف الزبون؟",
          progress: 20,
          options: ["077", "078", "075", "إلغاء الطلب"]
        })
      } else if (cleanText.includes("2") || cleanText.includes("وجهتين") || cleanText.includes("مرسل")) {
        draft.orderType = "two_way"
        draft.orderTypeTitle = "طلب وجهتين"
        setOrderDraft(draft)
        setActiveStep("TWOWAY_SENDER_PHONE")
        addMessage({
          sender: "ai",
          text: "تم اختيار (طلب وجهتين) 🛵\n\nالخطوة 1 من 7: ما هو رقم هاتف المرسل؟",
          progress: 14,
          options: ["إلغاء الطلب"]
        })
      } else if (cleanText.includes("3") || cleanText.includes("محل") || cleanText.includes("متجر")) {
        draft.orderType = "shop"
        draft.orderTypeTitle = "طلب من محل"
        setOrderDraft(draft)
        setActiveStep("SHOP_NAME")
        const shopNames = metadata.shops.slice(0, 6).map((s) => s.name)
        addMessage({
          sender: "ai",
          text: "تم اختيار (طلب من محل) 🏪\n\nالخطوة 1 من 7: ما هو اسم المحل؟",
          progress: 14,
          options: shopNames.length > 0 ? [...shopNames, "إلغاء الطلب"] : ["محل البركة", "محل النور", "إلغاء الطلب"]
        })
      } else {
        addMessage({
          sender: "ai",
          text: "يرجى اختيار نوع الطلب:\n1️⃣ طلب من الإدارة\n2️⃣ طلب وجهتين\n3️⃣ طلب من محل",
          options: ["1️⃣ طلب من الإدارة", "2️⃣ طلب وجهتين", "3️⃣ طلب من محل", "إلغاء الطلب"]
        })
      }
      return
    }

    // ==========================================
    // مسار 1: طلب من الإدارة (5 خطوات)
    // ==========================================
    if (activeStep === "ADMIN_PHONE") {
      draft.customerPhone = cleanText
      setOrderDraft(draft)
      setActiveStep("ADMIN_REGION")
      const areas = await fetchAreaSuggestions("ابو الخصيب")
      addMessage({
        sender: "ai",
        text: `تم حفظ الرقم: ${cleanText} ✅\n\nالخطوة 2 من 5: ما هي منطقة الزبون؟ (اكتبها أو اختر من الاقتراحات الذكية)`,
        progress: 40,
        options: [...areas, "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "ADMIN_REGION") {
      const cleanRegion = cleanText.replace(/هل تقصد:\s*|\؟/g, "")
      draft.customerRegionName = cleanRegion
      setOrderDraft(draft)
      setActiveStep("ADMIN_SUBTYPE")
      addMessage({
        sender: "ai",
        text: `تم تثبيت المنطقة: ${cleanRegion} 📍\n\nالخطوة 3 من 5: ما هو نوع الطلب؟`,
        progress: 60,
        options: ["وجبة طعام", "حلويات وعصائر", "هدايا وورود", "مستلزمات منزلية", "أغراض وأمانة", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "ADMIN_SUBTYPE") {
      draft.orderSubtype = cleanText
      setOrderDraft(draft)
      setActiveStep("ADMIN_PRICE")
      addMessage({
        sender: "ai",
        text: `النوع: ${cleanText} 🛍️\n\nالخطوة 4 من 5: كم هو سعر أو مبلغ الطلب بالدينار؟`,
        progress: 80,
        options: ["5,000 د.ع", "10,000 د.ع", "15,000 د.ع", "25,000 د.ع", "50,000 د.ع", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "ADMIN_PRICE") {
      draft.price = cleanText
      setOrderDraft(draft)
      setActiveStep("ADMIN_TIME")
      addMessage({
        sender: "ai",
        text: `المبلغ: ${cleanText} 💰\n\nالخطوة 5 والأخيرة: ما هو وقت تسليم الطلب؟`,
        progress: 95,
        options: ["توصيل فوري الآن ⚡", "خلال ساعة", "بعد ساعتين", "العصر 4:00", "المساء 8:00", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "ADMIN_TIME") {
      draft.orderTime = cleanText
      setOrderDraft(draft)
      await finalizeOrderCreation(draft)
      return
    }

    // ==========================================
    // مسار 2: طلب وجهتين (7 خطوات)
    // ==========================================
    if (activeStep === "TWOWAY_SENDER_PHONE") {
      draft.senderPhone = cleanText
      setOrderDraft(draft)
      setActiveStep("TWOWAY_RECIPIENT_PHONE")
      addMessage({
        sender: "ai",
        text: `هاتف المرسل: ${cleanText} ✅\n\nالخطوة 2 من 7: ما هو رقم هاتف المستلم؟`,
        progress: 28,
        options: ["إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_RECIPIENT_PHONE") {
      draft.customerPhone = cleanText
      setOrderDraft(draft)
      setActiveStep("TWOWAY_SENDER_REGION")
      const areas = await fetchAreaSuggestions("ابو الخصيب")
      addMessage({
        sender: "ai",
        text: `هاتف المستلم: ${cleanText} ✅\n\nالخطوة 3 من 7: ما هي منطقة المرسل (نقطة الاستلام)؟`,
        progress: 42,
        options: [...areas, "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_SENDER_REGION") {
      const cleanRegion = cleanText.replace(/هل تقصد:\s*|\؟/g, "")
      draft.senderRegionName = cleanRegion
      setOrderDraft(draft)
      setActiveStep("TWOWAY_RECIPIENT_REGION")
      const areas = await fetchAreaSuggestions("البصرة")
      addMessage({
        sender: "ai",
        text: `منطقة المرسل: ${cleanRegion} 📍\n\nالخطوة 4 من 7: ما هي منطقة المستلم (وجهة التسليم)؟`,
        progress: 57,
        options: [...areas, "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_RECIPIENT_REGION") {
      const cleanRegion = cleanText.replace(/هل تقصد:\s*|\؟/g, "")
      draft.customerRegionName = cleanRegion
      setOrderDraft(draft)
      setActiveStep("TWOWAY_SUBTYPE")
      addMessage({
        sender: "ai",
        text: `منطقة المستلم: ${cleanRegion} 🏁\n\nالخطوة 5 من 7: ما هو نوع وتفاصيل الطلب؟`,
        progress: 71,
        options: ["أمانة ومستندات", "طرد وملابس", "هدية خاصة", "أجهزة وقطع غيار", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_SUBTYPE") {
      draft.orderSubtype = cleanText
      setOrderDraft(draft)
      setActiveStep("TWOWAY_PRICE")
      addMessage({
        sender: "ai",
        text: `نوع الشحنة: ${cleanText} 📦\n\nالخطوة 6 من 7: ما هو سعر أو أجور الطلب؟`,
        progress: 85,
        options: ["5,000 د.ع", "7,000 د.ع", "10,000 د.ع", "15,000 د.ع", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_PRICE") {
      draft.price = cleanText
      setOrderDraft(draft)
      setActiveStep("TWOWAY_TIME")
      addMessage({
        sender: "ai",
        text: `المبلغ: ${cleanText} 💰\n\nالخطوة 7 والأخيرة: ما هو وقت التوصيل المناسب؟`,
        progress: 95,
        options: ["فوري الآن", "اليوم ظهراً", "المساء", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "TWOWAY_TIME") {
      draft.orderTime = cleanText
      setOrderDraft(draft)
      await finalizeOrderCreation(draft)
      return
    }

    // ==========================================
    // مسار 3: طلب من محل (7 خطوات)
    // ==========================================
    if (activeStep === "SHOP_NAME") {
      draft.shopName = cleanText
      setOrderDraft(draft)
      setActiveStep("SHOP_CUSTOMER_NAME")
      const custNames = metadata.customers.slice(0, 6).map((c) => c.name)
      addMessage({
        sender: "ai",
        text: `المحل: ${cleanText} 🏪\n\nالخطوة 2 من 7: ما هو اسم العميل؟ (اكتبه أو اختر من القائمة)`,
        progress: 28,
        options: custNames.length > 0 ? [...custNames, "عميل نقدي", "إلغاء الطلب"] : ["عميل نقدي", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_CUSTOMER_NAME") {
      draft.customerName = cleanText
      setOrderDraft(draft)
      setActiveStep("SHOP_REGION")
      const areas = await fetchAreaSuggestions("ابو الخصيب")
      addMessage({
        sender: "ai",
        text: `اسم العميل: ${cleanText} 👤\n\nالخطوة 3 من 7: ما هي منطقة الزبون؟`,
        progress: 42,
        options: [...areas, "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_REGION") {
      const cleanRegion = cleanText.replace(/هل تقصد:\s*|\؟/g, "")
      draft.customerRegionName = cleanRegion
      setOrderDraft(draft)
      setActiveStep("SHOP_CUSTOMER_PHONE")
      addMessage({
        sender: "ai",
        text: `المنطقة: ${cleanRegion} 📍\n\nالخطوة 4 من 7: ما هو رقم هاتف الزبون؟`,
        progress: 57,
        options: ["077", "078", "075", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_CUSTOMER_PHONE") {
      draft.customerPhone = cleanText
      setOrderDraft(draft)
      setActiveStep("SHOP_PRICE")
      addMessage({
        sender: "ai",
        text: `رقم الزبون: ${cleanText} 📱\n\nالخطوة 5 من 7: ما هو سعر أو مبلغ الطلب؟`,
        progress: 71,
        options: ["10,000 د.ع", "15,000 د.ع", "25,000 د.ع", "35,000 د.ع", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_PRICE") {
      draft.price = cleanText
      setOrderDraft(draft)
      setActiveStep("SHOP_SUBTYPE")
      addMessage({
        sender: "ai",
        text: `المبلغ: ${cleanText} 💰\n\nالخطوة 6 من 7: ما هو نوع ومحتوى الطلب؟`,
        progress: 85,
        options: ["أكل ومطاعم", "كيك وحلويات", "ملابس", "عطور ومكياج", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_SUBTYPE") {
      draft.orderSubtype = cleanText
      setOrderDraft(draft)
      setActiveStep("SHOP_TIME")
      addMessage({
        sender: "ai",
        text: `محتوى الطلب: ${cleanText} 📦\n\nالخطوة 7 والأخيرة: ما هو وقت التسليم؟`,
        progress: 95,
        options: ["فوري الآن ⚡", "خلال نصف ساعة", "خلال ساعة", "المساء", "إلغاء الطلب"]
      })
      return
    }

    if (activeStep === "SHOP_TIME") {
      draft.orderTime = cleanText
      setOrderDraft(draft)
      await finalizeOrderCreation(draft)
      return
    }
  }

  // الإنشاء النهائي للطلب في قاعدة البيانات عبر POST إلى /api/ai-agent
  const finalizeOrderCreation = async (completedDraft: OrderDraft) => {
    setActiveStep(null)
    setAreaSuggestions([])
    setLoading(true)

    addMessage({
      sender: "ai",
      text: "جاري إدخال وتثبيت الطلب في النظام فوراً... ⏳",
      status: "info",
      progress: 100
    })

    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_order",
          orderType: completedDraft.orderTypeTitle || "طلب من الإدارة",
          customerPhone: completedDraft.customerPhone,
          customerRegionName: completedDraft.customerRegionName,
          senderPhone: completedDraft.senderPhone,
          senderRegionName: completedDraft.senderRegionName,
          shopName: completedDraft.shopName,
          customerName: completedDraft.customerName,
          orderSubtype: completedDraft.orderSubtype,
          price: completedDraft.price,
          orderTime: completedDraft.orderTime
        })
      })

      const data = await res.json()

      if (data.done) {
        addMessage({
          sender: "ai",
          text: `🎉 ${data.message}\n\n• نوع الطلب: ${completedDraft.orderTypeTitle}\n• المنطقة: ${completedDraft.customerRegionName || "غير محدد"}\n• الهاتف: ${completedDraft.customerPhone || "—"}\n• السعر: ${completedDraft.price || "0"}\n• وقت التسليم: ${completedDraft.orderTime || "فوري"}\n\nالطلب الآن في حالة (معلق - Pending) وجاهز للإسناد!`,
          action: `order_created_#${data.orderId}`,
          status: "success",
          options: ["سويلي طلب ثاني", "اسند هذا الطلب الى فارس", "صفر حساب فارس"]
        })
      } else {
        addMessage({
          sender: "ai",
          text: `❌ تعذر إنشاء الطلب: ${data.error || "خطأ غير متوقع"}`,
          status: "error",
          options: ["أعد المحاولة", "سويلي طلب"]
        })
      }
    } catch (err: any) {
      addMessage({
        sender: "ai",
        text: `⚠️ خطأ في الاتصال بالخادم: ${err?.message}`,
        status: "error",
        options: ["سويلي طلب"]
      })
    } finally {
      setLoading(false)
      setOrderDraft({})
    }
  }

  // إرسال النص العادي أو الأمر
  const handleSend = async (commandToSend?: string) => {
    const textToSend = (commandToSend || input).trim()
    if (!textToSend || loading) return

    // إضافة رسالة المستخدم
    addMessage({
      sender: "user",
      text: textToSend
    })

    if (!commandToSend) setInput("")

    // معالجة خيار الإلغاء
    if (textToSend.includes("إلغاء") || textToSend.includes("الغاء")) {
      cancelOrderFlow()
      return
    }

    // إذا كنا داخل محرك الأسئلة
    if (activeStep) {
      await handleOrderWizard(textToSend)
      return
    }

    // إذا بدأ المستخدم بطلب جديد
    if (
      textToSend.includes("سويلي طلب") ||
      textToSend.includes("طلب جديد") ||
      textToSend.includes("انشئ طلب") ||
      textToSend.includes("اريد اسوي طلب")
    ) {
      setActiveStep("CHOOSE_TYPE")
      setOrderDraft({})
      addMessage({
        sender: "ai",
        text: "حياك الله يا أبو الأكبر! تدلل، شنو نوع الطلب؟\n\n1️⃣ طلب من الإدارة\n2️⃣ طلب وجهتين\n3️⃣ طلب من محل",
        progress: 5,
        options: ["1️⃣ طلب من الإدارة", "2️⃣ طلب وجهتين", "3️⃣ طلب من محل"]
      })
      return
    }

    // الأوامر الأخرى (تصفير، إخفاء، إسناد، حالة...)
    setLoading(true)
    try {
      const res = await fetch("/api/ai-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSend })
      })

      const data = await res.json()

      addMessage({
        sender: "ai",
        text: data.done ? data.message : `❌ ${data.error || "تعذر تنفيذ الأمر"}`,
        action: data.action,
        status: data.done ? "success" : "error",
        options: data.done ? ["سويلي طلب", "صفر حساب فارس", "اسند طلب 2815 الى فارس"] : undefined
      })
    } catch (err: any) {
      addMessage({
        sender: "ai",
        text: `⚠️ خطأ في الاتصال: ${err?.message}`,
        status: "error"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-2 sm:p-4"
    >
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col h-[94vh] overflow-hidden">
        {/* شريط الرأس */}
        <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-emerald-400 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/10">
                🎙️
              </div>
              <span className="absolute -bottom-1 -left-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
              </span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                وكيل الطلبات الفائق بالصوت
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  شغال 100%
                </span>
              </h1>
              <p className="text-xs text-slate-400">aboakbr.com — يفهم كلامك بالصوت والعراقي وينفذ فوراً</p>
            </div>
          </div>

          {activeStep && (
            <button
              onClick={cancelOrderFlow}
              className="text-xs bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 px-3 py-1.5 rounded-xl transition-all"
            >
              ✕ إلغاء الطلب
            </button>
          )}
        </div>

        {/* منطقة المحادثة */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((m) => {
            const isUser = m.sender === "user"
            return (
              <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[90%] sm:max-w-[78%] rounded-3xl p-4 shadow-md transition-all ${
                    isUser
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-sm"
                      : m.status === "error"
                      ? "bg-rose-950/60 border border-rose-800 text-rose-200 rounded-bl-sm"
                      : m.status === "success"
                      ? "bg-emerald-950/40 border border-emerald-800/80 text-emerald-100 rounded-bl-sm"
                      : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-sm"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span className="text-xs font-semibold opacity-75">
                      {isUser ? "أنت (أبو الأكبر)" : "المساعد الذكي"}
                    </span>
                    <span className="text-[10px] opacity-60">{m.timestamp}</span>
                  </div>

                  {/* شريط التقدم إذا وجد في الرسالة */}
                  {m.progress !== undefined && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                        <span>تقدم إكمال الطلب</span>
                        <span className="font-mono text-emerald-400">{m.progress}%</span>
                      </div>
                      <div className="w-full bg-slate-900/80 h-2 rounded-full overflow-hidden border border-slate-700/50">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300"
                          style={{ width: `${m.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed font-medium">
                    {m.text}
                  </p>

                  {/* أزرار الاقتراحات السريعة الخاصة بالرسالة */}
                  {m.options && m.options.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                      {m.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(opt)}
                          disabled={loading}
                          className="text-xs bg-slate-900/80 hover:bg-emerald-600 hover:text-white text-slate-200 border border-slate-700 hover:border-emerald-500 px-3 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}

                  {m.action && (
                    <div className="mt-2 pt-2 border-t border-slate-700/40 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                      <span>✓ العملية:</span>
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
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
                <span className="text-xs font-medium">جاري التنفيذ والحفظ في قاعدة البيانات...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* حقل الإدخال وزر الصوت والإرسال */}
        <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2"
          >
            {/* زر الصوت المباشر */}
            <button
              type="button"
              onClick={toggleSpeechRecognition}
              title={isRecording ? "إيقاف التسجيل" : "تحدث بالصوت"}
              className={`p-3 sm:px-4 rounded-2xl flex items-center justify-center transition-all duration-300 active:scale-95 shadow-md ${
                isRecording
                  ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse ring-4 ring-rose-500/40"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              }`}
            >
              <span className="text-xl">{isRecording ? "🔴" : "🎙️"}</span>
              <span className="hidden sm:inline-block mr-2 text-xs font-bold">
                {isRecording ? "جاري الاستماع..." : "صوت"}
              </span>
            </button>

            {/* حقل الكتابة */}
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                if (activeStep?.includes("REGION") && e.target.value.length > 1) {
                  fetchAreaSuggestions(e.target.value)
                }
              }}
              placeholder={
                activeStep
                  ? "أدخل الإجابة هنا أو انقر على أحد الخيارات..."
                  : "اكتب أو تحدث: «سويلي طلب»، «صفر حساب فارس»، «اسند طلب 2815 لفارس»..."
              }
              disabled={loading}
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3 text-sm sm:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />

            {/* زر الإرسال */}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-5 py-3 rounded-2xl transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
            >
              <span className="text-sm">إرسال</span>
              <span>⚡</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
