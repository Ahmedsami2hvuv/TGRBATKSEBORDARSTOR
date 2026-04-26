"use client";

import { VoiceNotePreviewBlob } from "@/components/voice-note-audio";
import { useCallback, useEffect, useRef, useState } from "react";

const MAX_MS = 10_000;

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm";

type ClientVoiceNoteFieldProps = {
  fieldName?: string;
  title?: string;
  wrapperClassName?: string;
};

export function ClientVoiceNoteField({
  fieldName = "voiceNote",
  title = "ملاحظة صوتية (اختياري — حتى 10 ثوانٍ)",
  wrapperClassName = "mt-4",
}: ClientVoiceNoteFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSupported(false);
    } else if (!pickRecorderMime()) {
      setSupported(false);
    }
  }, []);

  const clearFile = useCallback(() => {
    const el = fileRef.current;
    if (el) {
      const dt = new DataTransfer();
      el.files = dt.files;
    }
    setPreviewBlob(null);
    setElapsedMs(0);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopTimers = () => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const finishRecording = () => {
    stopTimers();
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
  };

  const startRecording = async () => {
    setError(null);
    /** إطلاق أي ميكروفون أو مسجّل معلّق من جلسة سابقة (مهم بعد التنقّل أو إلغاء جزئي) */
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const prevMr = mrRef.current;
    if (prevMr && prevMr.state !== "inactive") {
      try {
        prevMr.onstop = null;
        prevMr.stop();
      } catch {
        /* ignore */
      }
    }
    mrRef.current = null;
    stopTimers();
    clearFile();
    const mime = pickRecorderMime();
    if (!mime || !supported) {
      setError("التسجيل الصوتي غير متاح في هذا المتصفح.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mrRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stopTimers();
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mrRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mime });
        chunksRef.current = [];
        if (blob.size === 0) {
          setError("لم يُسجَّل صوت. حاول مرة أخرى.");
          return;
        }
        const ext = blob.type.includes("webm")
          ? "webm"
          : blob.type.includes("mp4") || blob.type.includes("m4a")
            ? "m4a"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";
        const file = new File([blob], `voice.${ext}`, {
          type: blob.type || mime,
        });
        const input = fileRef.current;
        if (input) {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        }
        setPreviewBlob(blob);
        const dur = Date.now() - startedAtRef.current;
        setElapsedMs(Math.min(dur, MAX_MS));
      };
      startedAtRef.current = Date.now();
      setRecording(true);
      setElapsedMs(0);
      mr.start(200);
      tickRef.current = setInterval(() => {
        const t = Date.now() - startedAtRef.current;
        setElapsedMs(Math.min(t, MAX_MS));
      }, 100);
      maxTimerRef.current = setTimeout(() => {
        finishRecording();
      }, MAX_MS);
    } catch {
      setError("لم نتمكن من الوصول للميكروفون. اسمح بالوصول من إعدادات المتصفح.");
      setRecording(false);
    }
  };

  const cancelRecording = () => {
    stopTimers();
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") {
      mr.onstop = null;
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mrRef.current = null;
    chunksRef.current = [];
    setRecording(false);
    setElapsedMs(0);
  };

  if (!supported) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        التسجيل الصوتي غير مدعوم في هذا المتصفح. يمكنك كتابة الملاحظات في الحقل النصي.
      </div>
    );
  }

  const sec = (elapsedMs / 1000).toFixed(1);

  return (
    <div className={`${wrapperClassName} flex flex-col gap-2`}>
      <span className="text-sm font-medium text-slate-800">{title}</span>
      <input
        ref={fileRef}
        type="file"
        name={fieldName}
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-2">
        {!recording ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-900 shadow-sm hover:bg-rose-100"
          >
            🎤 تسجيل صوتي
          </button>
        ) : (
          <>
            <span
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400 bg-rose-100 px-3 py-2 text-sm font-bold text-rose-900 tabular-nums"
              aria-live="polite"
            >
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-600" />
              جارٍ التسجيل… {sec} / 10 ث
            </span>
            <button
              type="button"
              onClick={finishRecording}
              className="rounded-xl border border-emerald-500 bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"
            >
              إيقاف وحفظ
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              إلغاء
            </button>
          </>
        )}
        {previewBlob && !recording ? (
          <button
            type="button"
            onClick={clearFile}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            حذف التسجيل
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}
      {previewBlob && !recording ? (
        <VoiceNotePreviewBlob blob={previewBlob} className={`${inputClass} max-w-full`} />
      ) : null}
      <p className="text-xs text-slate-500">
        أقصى مدة <strong className="text-slate-700">10 ثوانٍ</strong>. يُرفَع مع الطلب ويستمع له المندوب والإدارة.
      </p>
    </div>
  );
}
