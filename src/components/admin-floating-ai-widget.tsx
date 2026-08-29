"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Volume2, VolumeX, X, Sparkles, Move, Loader2, Bot, Keyboard, MessageSquare } from "lucide-react";

export function AdminFloatingAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const [inputMessage, setInputMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [statusText, setStatusText] = useState("المساعد الصوتي الذكي جاهز");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMicPaused, setIsMicPaused] = useState(false); // زر إيقاف الميكروفون
  const [isMuted, setIsMuted] = useState(false);
  const [dynamicButtons, setDynamicButtons] = useState<Array<{ text: string; action: string }>>([]);

  const recognitionRef = useRef<any>(null);

  // السحب والإفلات السلس العائم في أي مكان بالمرونة الكاملة (حاسوب وهاتف)
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

  // ناطق الاستجابة الصوتي
  const speakResponse = (text: string) => {
    if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = text.replace(/[*#\-]|https?:\/\/\S+/g, "");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar";
    window.speechSynthesis.speak(utterance);
  };

  // الميكروفون والتعرف الصوتي
  const toggleVoiceListening = () => {
    if (isListening) {
      // إيقاف الميكروفون
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      setIsMicPaused(true);
      setStatusText("🛑 الميكروفون متوقف - يمكنك الكتابة بالنص فقط");
    } else {
      // تشغيل الميكروفون
      setIsMicPaused(false);
      startVoiceListening();
    }
  };

  const startVoiceListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusText("⚠️ التعرف الصوتي غير مدعوم بهذا المتصفح، استخدم الكتابة بالنص.");
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const rec = new SpeechRecognition();
      rec.lang = "ar-IQ";
      rec.continuous = false;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsListening(true);
        setIsMicPaused(false);
        setStatusText("🎙️ جاري الاستماع... اتحدث بأمرك الآن");
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);
        sendApiCommand(text);
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatusText("⚠️ تعذر سماع الصوت، يمكنك النقر للمحاولة أو الكتابة.");
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

  const sendApiCommand = async (textToSend: string) => {
    if (!textToSend.trim()) return;
    setIsLoading(true);
    setStatusText("⚡ جاري المعالجة والتنفيذ بالنظام...");
    setDynamicButtons([]);

    try {
      const res = await fetch("/api/ai/admin-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend, userId: "web_admin_floating_widget" })
      });

      const data = await res.json();
      setIsLoading(false);

      if (data.ok) {
        setStatusText("✅ تم تنفيذ الأمر بنجاح!");
        setResponseText(data.reply || "");
        if (data.buttons && Array.isArray(data.buttons)) {
          setDynamicButtons(data.buttons);
        }
        speakResponse(data.reply || "");
      } else {
        setStatusText("⚠️ خطأ في المعالجة.");
        setResponseText(data.error || data.message || "حدث خطأ غير متوقع.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setStatusText("❌ تعذر الاتصال بالسيرفر.");
      setResponseText(err.message || "خطأ بالاتصال");
    }
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
              if (newOpen && !isMicPaused) startVoiceListening();
            }
          }}
          className="group relative flex items-center justify-center w-16 h-16 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.6)] cursor-grab active:cursor-grabbing border-2 border-white/80 overflow-hidden transition-transform duration-150 hover:scale-105 active:scale-95 bg-gradient-to-tr from-blue-600 via-indigo-500 to-sky-200"
          title="مساعد أبو الأكبر الذكي - اسحب لتحريك المكان"
        >
          {/* التأثير البلوري السائل المضيء كـ Gemini Live */}
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-400 via-indigo-600 to-blue-300 opacity-90 animate-pulse"></div>
          <div className="absolute inset-1 rounded-full bg-gradient-to-b from-white/40 to-transparent blur-[2px]"></div>

          <Sparkles className="relative w-7 h-7 text-white animate-spin-slow drop-shadow-md" />
          <Move className="w-3.5 h-3.5 text-white/80 absolute top-1 right-1 opacity-70 group-hover:opacity-100" />
        </div>
      </div>

      {/* 2. شريط المساعد الصوتي العائم والمستنسخ بالضبط من Gemini Live (Gemini Floating Bar & Window) */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 380 : 300)}px`,
            top: `${Math.min(position.y + 75, typeof window !== "undefined" ? window.innerHeight - 520 : 400)}px`,
            zIndex: 1000000
          }}
          className="w-[92vw] max-w-[370px] bg-slate-950/95 backdrop-blur-xl text-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-slate-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 dir-rtl"
        >
          {/* Gemini Bar Header & Drag Control */}
          <div
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
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
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2 rounded-full text-xs font-semibold flex items-center justify-center transition-all ${
                  isMuted ? "bg-slate-800 text-slate-400" : "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                }`}
                title={isMuted ? "تفعيل الناطق الصوتي" : "كتم الناطق الصوتي"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors"
                title="إغلاق المساعد"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Gemini Live Visualizer Orb & Chat Content Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[220px] max-h-[300px] bg-slate-950/50">
            {/* الشكل البلوري المتوهج المتحرك أثناء الاستماع والمعالجة */}
            <div className="flex flex-col items-center justify-center py-3">
              <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening
                  ? "scale-110 shadow-[0_0_40px_rgba(59,130,246,0.8)] bg-gradient-to-tr from-blue-500 via-indigo-500 to-sky-300 animate-pulse"
                  : isLoading
                  ? "scale-105 shadow-[0_0_30px_rgba(168,85,247,0.8)] bg-gradient-to-tr from-purple-600 to-pink-500 animate-spin-slow"
                  : "shadow-[0_0_20px_rgba(59,130,246,0.4)] bg-gradient-to-tr from-slate-800 to-blue-900"
              }`}>
                <div className="w-16 h-16 rounded-full bg-slate-950/80 backdrop-blur-md flex items-center justify-center">
                  {isLoading ? (
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                  ) : isListening ? (
                    <Mic className="w-8 h-8 text-sky-400 animate-bounce" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-blue-400" />
                  )}
                </div>
              </div>
            </div>

            {transcript && (
              <div className="bg-slate-900/90 text-slate-100 p-3 rounded-2xl text-xs font-medium border border-slate-800 shadow-inner">
                🎙️ &quot;{transcript}&quot;
              </div>
            )}

            {responseText && (
              <div className="bg-slate-900/90 text-slate-200 p-3.5 rounded-2xl border border-slate-800 text-xs leading-relaxed space-y-2 whitespace-pre-wrap">
                {responseText}

                {/* الأزرار التفاعلية المباشرة */}
                {dynamicButtons.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800 flex flex-col gap-1.5">
                    <p className="text-[11px] text-slate-400 font-bold">خيارات التجهيز والمجهزين المفصلة:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {dynamicButtons.map((btn, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setTranscript(btn.text);
                            sendApiCommand(btn.text);
                          }}
                          className="p-2 bg-blue-950/60 hover:bg-blue-900/80 text-blue-300 font-bold text-[11px] rounded-xl border border-blue-800/60 transition-colors text-center"
                        >
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gemini Live Control Bar بنفس التصميم والزرار الموضحة بالصور */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col gap-2.5">
            {/* شريط الإدخال النصي عند رغبة المدير بالكتابة فقط */}
            {showTextInput && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inputMessage.trim()) {
                    setTranscript(inputMessage);
                    sendApiCommand(inputMessage);
                    setInputMessage("");
                  }
                }}
                className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="اكتب الأمر النصي هنا..."
                  className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 text-white rounded-2xl border border-slate-700 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/30"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* الأزرار البيضاء العائمة المطابقة لـ Gemini Live Screen بالضبط */}
            <div className="flex items-center justify-between gap-2 px-1 py-1">
              {/* 1. زر إغلاق X */}
              <button
                onClick={() => setIsOpen(false)}
                className="w-12 h-12 rounded-full bg-white text-slate-900 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-lg active:scale-95"
                title="إغلاق المساعد"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 2. زر تشغيل / إيقاف الميكروفون المباشر */}
              <button
                onClick={toggleVoiceListening}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : isMicPaused
                    ? "bg-slate-700 text-slate-300"
                    : "bg-white text-slate-900 hover:bg-slate-200"
                }`}
                title={isListening ? "إيقاف الاستماع الصوتي" : "تفعيل الميكروفون الصوتي"}
              >
                {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              {/* 3. الشعار المتوهج البيضاوي المستنسخ لـ Gemini Live في المنتصف مع خاصية السحب */}
              <div
                onMouseDown={handleStartDrag}
                onTouchStart={handleStartDrag}
                onClick={() => {
                  if (!isListening && !isMicPaused) startVoiceListening();
                }}
                className="flex-1 h-12 rounded-full bg-gradient-to-r from-sky-400 via-indigo-500 to-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.6)] cursor-grab active:cursor-grabbing flex items-center justify-center gap-1.5 text-white font-bold text-xs hover:opacity-95 transition-opacity px-3"
                title="Gemini Live Bar - اسحب لتحريك الشاشة أو انقر لبدء التحدث"
              >
                <Sparkles className="w-4 h-4 animate-spin-slow" />
                <span className="text-[11px] font-semibold">{isListening ? "جاري التحدث..." : "Gemini Live"}</span>
              </div>

              {/* 4. زر فتح الكتابة النصية والمكالمات (Keyboard / Text Toggle) */}
              <button
                onClick={() => setShowTextInput(!showTextInput)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
                  showTextInput ? "bg-blue-600 text-white" : "bg-white text-slate-900 hover:bg-slate-200"
                }`}
                title="فتح مربع الكتابة النصية"
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
