"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, Volume2, VolumeX, X, Sparkles, Move, Loader2, Bot } from "lucide-react";

export function AdminFloatingAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  const [inputMessage, setInputMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [statusText, setStatusText] = useState("جاهز للاستماع والتنفيذ...");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dynamicButtons, setDynamicButtons] = useState<Array<{ text: string; action: string }>>([]);

  const recognitionRef = useRef<any>(null);

  // السحب والإفلات السلس العائم في أي مكان بالمرونة الكاملة
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

    const maxX = typeof window !== "undefined" ? window.innerWidth - 70 : 300;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 70 : 600;

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

  // إعداد محرك الناطق والتعرف الصوتي
  const speakResponse = (text: string) => {
    if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleanText = text.replace(/[*#\-]|https?:\/\/\S+/g, "");
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar";
    window.speechSynthesis.speak(utterance);
  };

  const startVoiceListening = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatusText("⚠️ التعرف الصوتي غير مدعوم بهذا المتصفح، يمكنك الكتابة بالنص أدناه.");
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
        setStatusText("🎙️ الميكروفون شغال... تحدث براحتك بالأمر");
      };

      rec.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsListening(false);
        sendApiCommand(text);
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatusText("⚠️ يمكنك الكتابة أو النقر لإعادة التحدث.");
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
    setStatusText("🚀 جاري معالجة الأمر والتنفيذ بالنظام...");
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
        setStatusText("⚠️ خطأ في معالجة الطلب.");
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
      {/* 1. الزر العائم المباشر الذكي القابل للتحريك في أي مكان بالشاشة */}
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
            if (!hasMoved) setIsOpen(!isOpen);
          }}
          className="group relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-150 border-2 border-white cursor-grab active:cursor-grabbing"
          title="مساعد أبو الأكبر الذكي العائم - انقر للفتح أو اسحب لتحريك المكان"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <Move className="w-3 h-3 absolute top-1 right-1 opacity-60 group-hover:opacity-100" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
        </div>
      </div>

      {/* 2. نافذة المساعد العائمة القابلة للتحريك أيضاً بنفس السلاسة */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 380 : 300)}px`,
            top: `${Math.min(position.y + 60, typeof window !== "undefined" ? window.innerHeight - 520 : 400)}px`,
            zIndex: 1000000
          }}
          className="w-[92vw] max-w-[370px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-800 dir-rtl"
        >
          {/* Header & Move Handle */}
          <div
            onMouseDown={handleStartDrag}
            onTouchStart={handleStartDrag}
            className="bg-slate-900 text-white p-3 flex items-center justify-between shadow-md cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-xs leading-tight flex items-center gap-1">
                  مساعد أبو الأكبر الذكي
                  <Move className="w-3 h-3 text-slate-400" />
                </h3>
                <p className="text-[10px] text-emerald-400 font-medium">اسحب الشريط العائم لتحريك الشاشة</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isMuted ? "bg-slate-700 text-slate-400" : "bg-emerald-600 text-white"
                }`}
                title={isMuted ? "تفعيل الناطق الصوتي" : "إيقاف الناطق الصوتي"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="bg-slate-50 border-b border-slate-100 p-2 text-center">
            <p className={`text-xs font-semibold ${isListening ? "text-emerald-600 animate-pulse" : "text-slate-600"}`}>
              {statusText}
            </p>
          </div>

          {/* Chat Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50/50">
            {transcript && (
              <div className="bg-slate-200 text-slate-900 p-3 rounded-xl text-xs font-medium self-end mr-auto max-w-[85%] border border-slate-300">
                💬 &quot;{transcript}&quot;
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs p-3 bg-white rounded-xl shadow-sm border border-slate-100 w-fit">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                جاري تنفيذ وتثبيت الأمر...
              </div>
            )}

            {responseText && (
              <div className="bg-white text-slate-800 p-3.5 rounded-xl shadow-sm border border-slate-100 text-xs leading-relaxed space-y-2 whitespace-pre-wrap">
                {responseText}

                {/* الأزرار التفاعلية المباشرة */}
                {dynamicButtons.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                    <p className="text-[11px] text-slate-500 font-bold">خيارات التجهيز والمجهزين المفصلة:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {dynamicButtons.map((btn, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setTranscript(btn.text);
                            sendApiCommand(btn.text);
                          }}
                          className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200 transition-colors text-center"
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

          {/* Controls Input Bottom */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputMessage.trim()) {
                  setTranscript(inputMessage);
                  sendApiCommand(inputMessage);
                  setInputMessage("");
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="اكتب الأمر الإداري أو التجهيز..."
                className="flex-1 px-3 py-2 text-xs bg-slate-100 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={startVoiceListening}
                disabled={isListening || isLoading}
                className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gradient-to-r from-emerald-600 to-teal-700 text-white hover:opacity-90"
                }`}
              >
                <Mic className="w-4 h-4" />
                {isListening ? "جاري الاستماع..." : "🎙️ التحدث صوتاً"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
