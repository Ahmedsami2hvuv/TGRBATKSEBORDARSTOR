"use client";

import { useState, useEffect } from "react";
import { Mic, MicOff, Send, Sparkles, CheckCircle2, AlertCircle, RefreshCw, Volume2, VolumeX } from "lucide-react";

export default function VoiceAssistantPage() {
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMute = localStorage.getItem("voice_assistant_muted");
      if (savedMute === "true") {
        setIsMuted(true);
      }

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "ar-IQ";

        rec.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join("");
          setInputText(transcript);
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    if (typeof window !== "undefined") {
      localStorage.setItem("voice_assistant_muted", String(newMuteState));
      if (newMuteState && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const speakText = (text: string) => {
    if (isMuted || typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#\-]|https?:\/\/\S+/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "ar-SA";
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (!recognition) {
      alert("متصفحك لا يدعم التعرف الصوتي المباشر، يمكنك كتابة الأمر نصياً في الحقل أدناه.");
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      setInputText("");
      setError(null);
      recognition.start();
      setIsListening(true);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await fetch("/api/ai/admin-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      const data = await res.json();
      if (data.ok) {
        setResponse(data.reply);
        speakText(data.reply);
      } else {
        const errText = data.message || data.error || "حدث خطأ أثناء معالجة الأمر";
        setError(errText);
      }
    } catch (err: any) {
      setError(err.message || "تعذر الاتصال بالسيرفر");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 dir-rtl text-right">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 animate-pulse text-amber-300" />
              <h1 className="text-2xl font-extrabold">المساعد الصوتي الذكي Gemini</h1>
            </div>
            <p className="text-emerald-100 text-sm">
              أمر المبيعات والتوصيل والتجهيز والديون بصوتك المباشر أو بالنص بنقرة زر واحدة من هاتفك!
            </p>
          </div>

          {/* Toggle Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-3 rounded-2xl flex items-center gap-2 transition-all shadow-md font-bold text-sm ${
              isMuted
                ? "bg-slate-800 text-slate-300 hover:bg-slate-900 border border-slate-700"
                : "bg-white text-emerald-700 hover:bg-emerald-50 shadow-emerald-900/20"
            }`}
            title={isMuted ? "الصوت مكتوم دائماً - انقر للتشغيل" : "الصوت مفعل - انقر للكتم"}
          >
            {isMuted ? (
              <>
                <VolumeX className="w-5 h-5 text-red-400" />
                <span>مكتوم دائماً</span>
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5 text-emerald-600 animate-bounce" />
                <span>الصوت مفعل</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Mic Card */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md text-center space-y-6">
        <div className="flex justify-center">
          <button
            onClick={toggleListening}
            className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all transform hover:scale-105 shadow-2xl ${
              isListening
                ? "bg-red-500 text-white animate-pulse ring-8 ring-red-200"
                : "bg-gradient-to-tr from-emerald-500 to-teal-600 text-white hover:shadow-emerald-200"
            }`}
          >
            {isListening ? <MicOff className="w-12 h-12" /> : <Mic className="w-12 h-12" />}
          </button>
        </div>

        <p className="text-slate-600 font-medium">
          {isListening ? "جاري الاستماع لصوتك الآن... تحدث بوضوح" : "انقر على زر الميكروفون وتحدث بأمرك فوراً"}
        </p>

        {/* Input Area */}
        <div className="flex items-end gap-2">
          <textarea
            rows={Math.min(4, Math.max(1, inputText.split("\n").length))}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب الأمر هنا... (Shift + Enter لسطر جديد)"
            className="flex-1 px-4 py-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 resize-none max-h-32 overflow-y-auto leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (inputText.trim() && !isLoading) {
                  handleSend();
                }
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all shrink-0"
          >
            {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span>تنفيذ</span>
          </button>
        </div>
      </div>

      {/* Response Display */}
      {response && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-emerald-800 font-bold">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <span>نتيجة الاستجابة والتثبيت:</span>
          </div>
          <div className="text-slate-800 whitespace-pre-wrap leading-relaxed font-medium bg-white p-4 rounded-2xl border border-emerald-100 shadow-inner">
            {response}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-red-800 font-bold">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <span>تنبيه:</span>
          </div>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Direct Mobile Webhook Link Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 text-sm text-slate-600 space-y-2">
        <p className="font-bold text-slate-800">💡 اختصار زر الهاتف والمساعد الصوتي:</p>
        <p>
          يمكنك إضافة هذه الصفحة لشاشة هاتفك الرئيسية (Add to Home Screen)، أو ربط الرابط المباشر 
          <code className="bg-slate-200 px-2 py-1 rounded mx-1 text-slate-800 font-mono">/api/ai/admin-voice</code>
          بأي تطبيق اختصار صوتي في هاتفك (Android Shortcuts / iPhone Shortcuts) لرفع الأوامر بنقرة زر واحدة!
        </p>
      </div>
    </div>
  );
}
