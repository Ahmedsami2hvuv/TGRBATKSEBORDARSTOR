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
    "audio/m4a",
    "audio/aac",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/3gpp",
  ];
  if (typeof MediaRecorder.isTypeSupported === "function") {
    for (const t of types) {
      try {
        if (MediaRecorder.isTypeSupported(t)) return t;
      } catch {
        /* ignore */
      }
    }
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
  variant?: "embedded" | "standalone" | "button" | "royal_circular";
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
    const hasMedia = Boolean(
      (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
      (navigator as any).getUserMedia ||
      (navigator as any).webkitGetUserMedia
    );
    if (!hasMedia || typeof MediaRecorder === "undefined") {
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

  const nativeMicInputRef = useRef<HTMLInputElement>(null);

  const handleNativeMicFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const input = fileRef.current;
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
    }
    setPreviewBlob(file);
    setError(null);

    if (variant === "standalone" || variant === "button") {
      queueMicrotask(() => {
        standaloneFormRef.current?.requestSubmit();
      });
    }
  };

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

    if (!supported) {
      if (nativeMicInputRef.current) {
        nativeMicInputRef.current.click();
        return;
      }
      setError("التسجيل الصوتي غير متاح في هذا المتصفح.");
      return;
    }

    try {
      let stream: MediaStream;
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if ((navigator as any).getUserMedia) {
        stream = await new Promise((resolve, reject) => {
          (navigator as any).getUserMedia.call(navigator, { audio: true }, resolve, reject);
        });
      } else if ((navigator as any).webkitGetUserMedia) {
        stream = await new Promise((resolve, reject) => {
          (navigator as any).webkitGetUserMedia.call(navigator, { audio: true }, resolve, reject);
        });
      } else {
        throw new Error("NO_USER_MEDIA");
      }

      streamRef.current = stream;
      chunksRef.current = [];

      const mime = pickRecorderMime();
      const options = mime ? { mimeType: mime } : undefined;
      const mr = new MediaRecorder(stream, options);
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
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mime || "audio/m4a" });
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
              : "m4a";
        const file = new File([blob], `admin-voice.${ext}`, {
          type: blob.type || mime || "audio/m4a",
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

        if (variant === "standalone" || variant === "button") {
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
    } catch (err: any) {
      console.error("Audio recording error, triggering native mic fallback:", err);
      setRecording(false);
      if (nativeMicInputRef.current) {
        nativeMicInputRef.current.click();
      } else {
        setError("لم نتمكن من الوصول للمايك. اسمح بالوصول من إعدادات المتصفح والتطبيق.");
      }
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
      <input
        ref={nativeMicInputRef}
        type="file"
        accept="audio/*"
        capture="microphone"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleNativeMicFile}
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
        </div>
      ) : (
        <p className="text-xs text-amber-900">هذا المتصفح لا يدعم التسجيل الصوتي من المايك.</p>
      )}
    </>
  );

  const inner = (
    <div className="rounded-2xl border-2 border-sky-100 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-black text-sky-600 flex items-center gap-1"><span>🎧</span> بصمة الإدارة (النظام)</span>
        {src ? <DeleteAdminVoiceNoteButton orderId={orderId} /> : null}
      </div>

      {src ? (
        <div className="mb-3">
          <VoiceNoteAudio
            src={src}
            streamKey={`${orderId}-admin-voice`}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">{controls}</div>
    </div>
  );

  if (variant === "royal_circular" || variant === "button") {
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
        className="inline-flex items-center shrink-0"
      >
        <input type="hidden" name="orderId" value={orderId} />
        <input
          ref={fileRef}
          type="file"
          name="adminVoice"
          accept="audio/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        {!recording ? (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="w-[36px] h-[36px] rounded-full bg-[#E11D48] border border-[#BE123C] text-white flex items-center justify-center shadow-[0_3px_10px_rgba(225,29,72,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.95] shrink-0 cursor-pointer hover:bg-[#D0153D] transition-transform"
            title={src ? "استبدال بصمة الصوت" : "تسجيل بصمة صوتية"}
          >
            <svg className="w-[18px] h-[18px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11c0 2.21-1.79 4-4 4s-4-1.79-4-4 1.79-4 4-4 4 1.79 4 4z" />
              <path d="M12 7c0-2.21 1.79-4 4-4s4 1.79 4 4v4c0 4.42-3.58 8-8 8s-8-3.58-8-8" />
              <path d="M8 15c0 2.21 1.79 4 4 4s4-1.79 4-4" />
              <path d="M12 3v1" />
              <path d="M16 11v2" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={finishRecording}
              className="h-[36px] px-2.5 rounded-full bg-emerald-600 text-white font-black text-[11px] flex items-center gap-1 shadow-md hover:bg-emerald-700 active:scale-95 cursor-pointer"
              title="حفظ التسجيل"
            >
              <span>✔</span>
              <span>({sec}ث)</span>
            </button>
            <button
              type="button"
              onClick={cancelRecording}
              className="w-[28px] h-[28px] rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center border border-rose-300 cursor-pointer"
              title="إلغاء"
            >
              ✕
            </button>
          </div>
        )}
      </form>
    );
  }

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
