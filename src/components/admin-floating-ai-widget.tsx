"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Volume2, VolumeX, X, Sparkles, Move, Loader2, Keyboard, Trash2 } from "lucide-react";

type ChatLogMessage = {
  id: string;
  sender: "user" | "ai";
  text: string;
  buttons?: Array<{ text: string; action: string }>;
  timestamp: string;
};

export function AdminFloatingAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const [inputMessage, setInputMessage] = useState("");
  const [statusText, setStatusText] = useState("المساعد الصوتي الذكي جاهز");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false); // مفعل الصوت افتراضياً دائماً

  // سجل المحادثة الكامل المتسلسل (Full Scrollable Chat Stream)
  const [messages, setMessages] = useState<ChatLogMessage[]>([
    {
      id: "init_msg",
      sender: "ai",
      text: "أهلاً بك يا أبو الأكبر! المساعد الصوتي الذكي جاهز لتنفيذ أوامرك فوراً بالصوت أو الكتابة! 🚀",
      timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const isMicPausedRef = useRef(isMicPaused);
  const isMutedRef = useRef(isMuted);
  const isSendingRef = useRef(false);
  const lastSentTextRef = useRef("");
  const lastSentTimeRef = useRef(0);
  const silenceTimerRef = useRef<any>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isMicPausedRef.current = isMicPaused;
  }, [isMicPaused]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // التمرير التلقائي لأسفل المحادثة عند وصول أي رسالة جديدة
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // السحب والإفلات السلس العائم في أي مكان
  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setIsDragging(true);
    setHasMoved(false);
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y
    });
  };

  const handleMoveDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

    const deltaX = Math.abs(clientX - (dragStart.x + position.x));
    const deltaY = Math.abs(clientY - (dragStart.y + position.y));
    if (deltaX > 5 || deltaY > 5) {
      setHasMoved(true);
    }

    const maxX = typeof window !== "undefined" ? window.innerWidth - 80 : 300;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 80 : 600;

    const newX = Math.max(10, Math.min(maxX, clientX - dragStart.x));
    const newY = Math.max(10, Math.min(maxY, clientY - dragStart.y));

    setPosition({ x: newX, y: newY });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const onMouseMove = (e: MouseEvent) => handleMoveDrag(e);
      const onTouchMove = (e: TouchEvent) => handleMoveDrag(e);
      const onMouseUp = () => handleEndDrag();
      const onTouchEnd = () => handleEndDrag();

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("touchmove", onTouchMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchend", onTouchEnd);

      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("touchend", onTouchEnd);
      };
    }
  }, [isDragging, dragStart, position]);

  // ناطق الاستجابة الصوتي مع إعادة فتح المايكروفون تلقائياً بعد انتهاء الكلام
  const speakResponse = (text: string, onFinish?: () => void) => {
    if (isMutedRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) {
      if (onFinish) onFinish();
      return;
    }

    const cleanText = text
      .replace(/[*#\-]|https?:\/\/\S+/g, "")
      .replace(/[^\u0600-\u06FF\s0-9.,!؟]/g, " ")
      .trim();

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar-IQ";
    utterance.rate = 1.05;

    utterance.onend = () => {
      if (onFinish) onFinish();
    };

    utterance.onerror = () => {
      if (onFinish) onFinish();
    };

    window.speechSynthesis.speak(utterance);
  };

  // تشغيل الميكروفون والتعرف الصوتي
  const startVoiceListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusText("⚠️ التعرف الصوتي غير مدعوم بهذا المتصفح، استخدم الكتابة بالنص.");
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }

      const rec = new SpeechRecognition();
      rec.lang = "ar-IQ";
      rec.continuous = true;
      rec.interimResults = true;

      let finalTranscript = "";

      rec.onstart = () => {
        setIsListening(true);
        setIsMicPaused(false);
        setStatusText("🎙️ الميكروفون شغال... تفضل بالتحدث براحتك");
      };

      rec.onresult = (event: any) => {
        if (isSendingRef.current) return;

        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? " " : "") + event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const fullSpokenText = (finalTranscript + (interimTranscript ? " " + interimTranscript : "")).trim();
        if (fullSpokenText) {
          setStatusText(`🎙️ أستمع لك: "${fullSpokenText}"`);

          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          silenceTimerRef.current = setTimeout(() => {
            if (fullSpokenText.trim() && !isSendingRef.current) {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.onresult = null;
                  recognitionRef.current.stop();
                } catch (e) {}
              }
              setIsListening(false);
              sendApiCommand(fullSpokenText);
            }
          }, 1800);
        }
      };

      rec.onerror = (err: any) => {
        if (err.error === "no-speech") {
          setStatusText("🎙️ بانتظار صوتك... تحدث الآن");
        } else {
          setIsListening(false);
          setStatusText("⚠️ انقر على المايك للتحدث.");
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      setIsListening(false);
      setStatusText("⚠️ تعذر فتح الميكروفون.");
    }
  };

  // تبديل حالة المايكروفون يدوياً
  const toggleVoiceListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      setIsMicPaused(true);
      setStatusText("🛑 الميكروفون متوقف - يمكنك الكتابة بالنص");
    } else {
      setIsMicPaused(false);
      startVoiceListening();
    }
  };

  // إرسال الأمر ومعالجته مع حماية صارمة لمنع التكرار
  const sendApiCommand = async (textToSend: string) => {
    const cleanText = (textToSend || "").trim();
    if (!cleanText) return;

    // حماية صارمة: منع إرسال نفس الطلب إذا كان قيد المعالجة أو تم إرساله قبل لحظات
    const now = Date.now();
    if (isSendingRef.current) return;
    if (now - lastSentTimeRef.current < 3000 && lastSentTextRef.current === cleanText) {
      return;
    }

    isSendingRef.current = true;
    lastSentTextRef.current = cleanText;
    lastSentTimeRef.current = now;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);

    const userMsgId = now.toString();
    const timeStr = new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

    // إضافة رسالة المستخدم مرة واحدة فقط
    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        sender: "user",
        text: cleanText,
        timestamp: timeStr
      }
    ]);

    setIsLoading(true);
    setStatusText("⚡ جاري المعالجة والتنفيذ بالنظام...");

    try {
      const res = await fetch("/api/ai/admin-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, userId: "web_admin_floating_widget" })
      });

      const data = await res.json();
      setIsLoading(false);

      const aiMsgId = (Date.now() + 1).toString();
      const aiTimeStr = new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" });

      if (data.ok) {
        setStatusText("✅ تم تنفيذ الأمر بنجاح!");
        setMessages(prev => [
          ...prev,
          {
            id: aiMsgId,
            sender: "ai",
            text: data.reply || "",
            buttons: Array.isArray(data.buttons) ? data.buttons : [],
            timestamp: aiTimeStr
          }
        ]);

        // نطق الاستجابة مرة واحدة بدون تشغيل المايك التلقائي الذي يسبب الصدى والتكرار
        speakResponse(data.reply || "");
      } else {
        setStatusText("⚠️ خطأ في المعالجة.");
        setMessages(prev => [
          ...prev,
          {
            id: aiMsgId,
            sender: "ai",
            text: data.error || data.message || "حدث خطأ غير متوقع.",
            timestamp: aiTimeStr
          }
        ]);
      }
    } catch (err: any) {
      setIsLoading(false);
      setStatusText("⚠️ تعذر الاتصال بالسيرفر.");
    } finally {
      // فتح قفل الإرسال بعد ثانية كاملة لضمان الاستقرار
      setTimeout(() => {
        isSendingRef.current = false;
      }, 1000);
    }
  };

  const clearChatHistory = async () => {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      await fetch("/api/ai/admin-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_session", userId: "web_admin_floating_widget" })
      }).catch(() => {});
    } catch (e) {}

    setMessages([
      {
        id: Date.now().toString(),
        sender: "ai",
        text: "تم تصفير السجل والبدء بدردشة جديدة ناصعة يا أبو الأكبر! 🚀",
        timestamp: new Date().toLocaleTimeString("ar-IQ", { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <>
      {/* 1. الكرة البلورية المتوهجة العائمة لـ Gemini Live (Orb Floating Trigger) */}
      <div
        style={{
          position: "fixed",
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: 999999,
          touchAction: "none"
        }}
        className="flex items-center gap-2 select-none"
      >
        <div
          onMouseDown={handleStartDrag}
          onTouchStart={handleStartDrag}
          onClick={() => {
            if (!hasMoved) {
              const newOpen = !isOpen;
              setIsOpen(newOpen);
              if (newOpen) {
                setIsMicPaused(false);
                setTimeout(() => startVoiceListening(), 250);
              } else {
                if (recognitionRef.current) {
                  try { recognitionRef.current.abort(); } catch (e) {}
                }
                if (typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
              }
            }
          }}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.6)] cursor-grab active:cursor-grabbing border-2 border-white/80 overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-95 bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-200"
          title="مساعد أبو الأكبر الذكي - انقر للفتح واسحب للتحريك"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-400 via-indigo-600 to-blue-300 opacity-90 animate-pulse"></div>
          <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/40 to-transparent blur-[2px]"></div>

          <Sparkles className="relative w-7 h-7 text-white animate-spin-slow drop-shadow-md" />
          <Move className="w-3.5 h-3.5 text-white/80 absolute top-1 right-1 opacity-70 group-hover:opacity-100" />
        </div>
      </div>

      {/* 2. شريط المساعد الصوتي العائم الناطق مع سجل المحادثة المتسلسل الكامل (Full Chat Stream) */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 390 : 300)}px`,
            top: `${Math.min(position.y + 75, typeof window !== "undefined" ? window.innerHeight - 560 : 400)}px`,
            zIndex: 1000000
          }}
          className="w-[94vw] max-w-[385px] bg-slate-950/95 backdrop-blur-xl text-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 dir-rtl"
        >
          {/* Header */}
          <div
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-sky-300 p-0.5 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-sky-400 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-xs leading-tight flex items-center gap-1.5 text-slate-100">
                  المساعد الصوتي الذكي
                  <Move className="w-3 h-3 text-slate-400" />
                </h3>
                <p className="text-[10px] text-sky-400 font-medium">{statusText}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={clearChatHistory}
                className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-red-400 rounded-full transition-colors"
                title="مسح سجل المحادثة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
                  isMuted ? "bg-slate-800 text-slate-400" : "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 animate-pulse"
                }`}
                title={isMuted ? "تفعيل الناطق الصوتي" : "كتم الناطق الصوتي"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (recognitionRef.current) {
                    try { recognitionRef.current.abort(); } catch (e) {}
                  }
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors"
                title="إغلاق المساعد"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Chat Stream History Area (سجل الدردشة الكامل القابل للتمرير) */}
          <div
            ref={chatScrollRef}
            className="flex-1 p-3.5 overflow-y-auto space-y-3 min-h-[260px] max-h-[340px] bg-slate-950/70 scrollbar-thin scrollbar-thumb-slate-800"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-start" : "items-end"} space-y-1`}
              >
                <div
                  className={`max-w-[88%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-tr-none border border-blue-500/50"
                      : "bg-slate-900/90 text-slate-200 rounded-tl-none border border-slate-800"
                  }`}
                >
                  {msg.sender === "user" && <span className="font-bold text-[10px] text-blue-200 block mb-1">🎙️ أنـت:</span>}
                  {msg.sender === "ai" && <span className="font-bold text-[10px] text-sky-400 block mb-1">✨ المساعد الذكي:</span>}

                  {msg.text}

                  {/* الأزرار التفاعلية المباشرة المرفقة بالرسالة */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        {msg.buttons.map((btn, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendApiCommand(btn.text)}
                            className="p-2 bg-blue-950/80 hover:bg-blue-900 text-blue-300 font-bold text-[11px] rounded-xl border border-blue-800/80 transition-colors text-center shadow-sm"
                          >
                            {btn.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[9px] text-slate-500 px-1">{msg.timestamp}</span>
              </div>
            ))}

            {/* حالة التحميل والتفكير الحية */}
            {isLoading && (
              <div className="flex items-center gap-2 p-2.5 bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-400 text-xs w-fit">
                <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                <span>جاري معالجة أمرك بالنظام...</span>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col gap-2.5">
            {/* شريط الإدخال النصي عند رغبة المدير بالكتابة */}
            {showTextInput && (
              <div className="flex items-end gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <textarea
                  rows={Math.min(4, Math.max(1, inputMessage.split("\n").length))}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (inputMessage.trim() && !isLoading) {
                        sendApiCommand(inputMessage);
                        setInputMessage("");
                      }
                    }
                  }}
                  placeholder="اكتب الأمر هنا... (Shift+Enter لسطر جديد)"
                  className="flex-1 px-3.5 py-2 text-xs bg-slate-950 text-white rounded-2xl border border-slate-700 focus:outline-none focus:border-blue-500 resize-none max-h-28 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-slate-800"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (inputMessage.trim() && !isLoading) {
                      sendApiCommand(inputMessage);
                      setInputMessage("");
                    }
                  }}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/30 shrink-0"
                  title="إرسال الأمر"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* الأزرار السفلى التفاعلية */}
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              {/* 1. زر الإغلاق على اليسار */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (recognitionRef.current) {
                    try { recognitionRef.current.abort(); } catch (e) {}
                  }
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className="w-11 h-11 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-md active:scale-95 border border-slate-700"
                title="إغلاق المساعد"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 2. زر الميكروفون المباشر */}
              <button
                onClick={toggleVoiceListening}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse ring-4 ring-red-500/30"
                    : isMicPaused
                    ? "bg-slate-800 text-slate-400 border border-slate-700"
                    : "bg-white text-slate-900 hover:bg-slate-200"
                }`}
                title={isListening ? "إيقاف الاستماع الصوتي" : "تفعيل الميكروفون الصوتي"}
              >
                {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* 3. شريط Gemini Live الأوسط المتوهج */}
              <div
                onMouseDown={handleStartDrag}
                onTouchStart={handleStartDrag}
                onClick={() => {
                  if (!isListening && !isMicPaused) startVoiceListening();
                }}
                className="flex-1 h-12 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.6)] cursor-grab active:cursor-grabbing flex items-center justify-center gap-1.5 text-white font-bold text-xs hover:opacity-95 transition-opacity px-2"
                title="Gemini Live Bar - انقر للتحدث أو اسحب للتحريك"
              >
                <Sparkles className="w-4 h-4 animate-spin-slow" />
                <span className="text-[11px] font-semibold">{isListening ? "جاري الاستماع..." : "تحدث بالأمر"}</span>
              </div>

              {/* 4. زر تشغيل / كتم صوت المساعد الذكي على اليمين */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-md active:scale-95 border ${
                  !isMuted
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30 animate-pulse"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
                title={!isMuted ? "صوت المساعد مفعل (انقر للكتم)" : "صوت المساعد مكتوم (انقر للتفعيل)"}
              >
                {!isMuted ? <Volume2 className="w-5 h-5 text-white" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
              </button>

              {/* 5. زر إظهار / إخفاء الكيبورد على اليمين */}
              <button
                onClick={() => setShowTextInput(!showTextInput)}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shadow-md active:scale-95 border ${
                  showTextInput
                    ? "bg-blue-600 text-white border-blue-500 shadow-blue-600/30"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
                }`}
                title="فتح / إغلاق لوحة المفاتيح للكتابة النصية"
              >
                <Keyboard className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
