"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Send, Volume2, VolumeX, X, Sparkles, Move, Loader2, Bot } from "lucide-react";

export function AdminFloatingAiWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const [inputMessage, setInputMessage] = useState("");
  const [transcript, setTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [statusText, setStatusText] = useState("جاهز للاستماع والتنفيذ...");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [dynamicButtons, setDynamicButtons] = useState<Array<{ text: string; action: string }>>([]);

  const recognitionRef = useRef<any>(null);

  // إعداد سحب وإفلات الزر العائم بالحاسوب والهاتف
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDragging(true);
    setDragOffset({
      x: window.innerWidth - clientX - position.x,
      y: window.innerHeight - clientY - position.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const newX = Math.max(10, Math.min(window.innerWidth - 70, window.innerWidth - clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 70, window.innerHeight - clientY - dragOffset.y));
    setPosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      const moveHandler = (e: MouseEvent) => handleTouchMove(e as any);
      const upHandler = () => handleTouchEnd();
      window.addEventListener("mousemove", moveHandler);
      window.addEventListener("mouseup", upHandler);
      return () => {
        window.removeEventListener("mousemove", moveHandler);
        window.removeEventListener("mouseup", upHandler);
      };
    }
  }, [isDragging, dragOffset]);

  // إعداد محرك الناطق والتعرف الصوتي على المتصفح
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

      rec.onerror = (event: any) => {
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
      {/* 1. Floating Action Draggable Button الزر العائم المباشر */}
      <div
        style={{
          position: "fixed",
          bottom: `${position.y}px`,
          left: `${position.x}px`,
          zIndex: 99999,
          touchAction: "none"
        }}
        className="flex items-center gap-2 select-none"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseDown={handleTouchStart}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-white cursor-grab active:cursor-grabbing"
          title="مساعد أبو الأكبر الذكي - اسحب لتحريك المكان بالنقر المباشر"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
          </span>
        </button>
      </div>

      {/* 2. Floating AI Assistant Modal/Window نافذة المساعد العائمة للموقع */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: `${Math.min(position.y + 60, window.innerHeight - 520)}px`,
            left: `${Math.min(position.x, window.innerWidth - 380)}px`,
            zIndex: 999999
          }}
          className="w-[92vw] max-w-[370px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 text-slate-800 dir-rtl"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white p-3.5 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-600 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">مساعد أبو الأكبر الذكي</h3>
                <p className="text-[11px] text-emerald-400 font-medium">أوامر المبيعات والتجهيز والديون</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
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

          {/* Status & Subtitle */}
          <div className="bg-slate-50 border-b border-slate-100 p-2.5 text-center">
            <p className={`text-xs font-semibold ${isListening ? "text-emerald-600 animate-pulse" : "text-slate-600"}`}>
              {statusText}
            </p>
          </div>

          {/* Chat Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50/50">
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
