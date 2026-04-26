"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceNoteAudio, VoiceNotePreviewBlob } from "@/components/voice-note-audio";
import { ad } from "@/lib/admin-ui";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { uploadAdminVoiceNote } from "./voice-note-actions";
import { DeleteAdminVoiceNoteButton } from "./delete-admin-voice-note-button";

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

/**
 * embedded: داخل نموذج تعديل الطلب — الحقل `adminVoice` يُرفَع مع زر «تحديث».
 * standalone: صفحة عرض الطلب فقط — يُرفَع تلقائياً بعد انتهاء التسجيل.
 */
export function AdminVoiceNoteSection({
  orderId,
  defaultAdminVoiceNoteUrl,
  variant = "embedded",
}: {
  orderId: string;
  defaultAdminVoiceNoteUrl: string | null;
  variant?: "embedded" | "standalone";
}) {
  const router = useRouter();
  const src = resolvePublicAssetSrc(defaultAdminVoiceNoteUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const standaloneFormRef = useRef<HTMLFormElement>(null);
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
      return;
    }
    if (!pickRecorderMime()) {
      setSupported(false);
    }
  }, []);

  const clearFile = useCallback(() => {
    const input = fileRef.current;
    if (input) {
      const dt = new DataTransfer();
      input.files = dt.files;
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

  const finishRecording = useCallback(() => {
    stopTimers();
    const mr = mrRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const startRecording = async () => {
    setError(null);
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
        const file = new File([blob], `admin-voice.${ext}`, {
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

        if (variant === "standalone") {
          queueMicrotask(() => {
            standaloneFormRef.current?.requestSubmit();
          });
        }
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
      setError("لم نتمكن من الوصول للمايك. اسمح بالوصول من إعدادات المتصفح.");
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
  const sec = (elapsedMs / 1000).toFixed(1);

  const controls = (
    <>
      <input
        ref={fileRef}
        type="file"
        name="adminVoice"
        accept="audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      {supported ? (
        <div className="flex w-full flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {!recording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-900 shadow-sm hover:bg-rose-100 disabled:opacity-60"
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
                  إيقاف
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
          {previewBlob && !recording ? (
            <VoiceNotePreviewBlob
              blob={previewBlob}
              className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50/60 p-2"
            />
          ) : null}
          {error ? <p className="text-xs font-medium text-rose-700">{error}</p> : null}
          <p className="text-xs text-slate-500">أقصى مدة 10 ثوانٍ.</p>
          {variant === "embedded" ? (
            <p className="text-xs font-semibold text-amber-900">
              سيتم رفع التسجيل عند الضغط على «تحديث» في أسفل الصفحة.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-amber-900">هذا المتصفح لا يدعم التسجيل الصوتي من المايك.</p>
      )}
    </>
  );

  const inner = (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <span className={ad.label}>بصمة الإدارة</span>
      {src ? (
        <div className="mt-3 space-y-2">
          <VoiceNoteAudio
            src={src}
            streamKey={`${orderId}-admin-voice`}
            className="w-full max-w-md rounded-lg"
          />
          <DeleteAdminVoiceNoteButton orderId={orderId} />
        </div>
      ) : null}
      <div className="mt-3">{controls}</div>
    </div>
  );

  if (variant === "standalone") {
    return (
      <form
        ref={standaloneFormRef}
        action={async (fd) => {
          const r = await uploadAdminVoiceNote(fd);
          if (r.error) {
            window.alert(r.error);
            return;
          }
          router.refresh();
        }}
        className="block w-full"
      >
        <input type="hidden" name="orderId" value={orderId} />
        {inner}
      </form>
    );
  }

  return inner;
}
