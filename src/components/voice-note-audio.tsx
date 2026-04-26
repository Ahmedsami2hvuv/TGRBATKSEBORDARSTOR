"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * معاينة تسجيل من Blob — بدون `blob:` URL حتى لا يُبطَل الرابط أثناء التشغيل (سبب شائع لتعطّل التكرار).
 */
export function VoiceNotePreviewBlob({
  blob,
  className,
}: {
  blob: Blob;
  className?: string;
}) {
  /** مفتاح ثابت لكل blob حتى يُعاد إنشاء العنصر عند تغيّر التسجيل دون استدعاء load() المتكرر (يُسبب اختفاء زر التشغيل) */
  const blobKey = useMemo(() => {
    const lm = blob instanceof File ? blob.lastModified : 0;
    return `${blob.size}-${blob.type}-${lm}`;
  }, [blob]);

  return (
    <VoiceNotePreviewBlobInner key={blobKey} blob={blob} className={className} />
  );
}

function VoiceNotePreviewBlobInner({
  blob,
  className,
}: {
  blob: Blob;
  className?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const objectUrl = URL.createObjectURL(blob);
    el.pause();
    el.src = objectUrl;
    return () => {
      el.pause();
      el.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && el.src) {
        try {
          el.load();
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <audio
      ref={ref}
      controls
      className={`min-h-[44px] w-full ${className ?? ""}`}
      preload="metadata"
      playsInline
      onEnded={(e) => {
        try {
          e.currentTarget.currentTime = 0;
        } catch {
          /* ignore */
        }
      }}
    />
  );
}

/**
 * مشغّل بصمة صوتية: تجنّب استدعاء `load()` بعد كل عرض — ذلك يعيد العنصر لحالة «بدون بيانات» ويُخفي/يومض شريط التحكم في WebKit.
 * إعادة المحاولة عند الخطأ فقط؛ إعادة تهيئة كاملة عبر `key` عند تغيّر المصدر أو `streamKey`.
 */
export function VoiceNoteAudio({
  src,
  className,
  streamKey,
}: {
  src: string;
  className?: string;
  streamKey?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [retryBust, setRetryBust] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [unsupportedType, setUnsupportedType] = useState(false);

  useEffect(() => {
    setRetryBust(0);
    setLoadFailed(false);
    setUnsupportedType(false);
  }, [src, streamKey]);

  const effectiveSrc = useMemo(() => {
    const raw = src.trim().toLowerCase();
    // لا تضف query على data URL (قد يجعلها غير صالحة في WebKit/الجوال)
    if (raw.startsWith("data:")) return src;
    if (retryBust === 0) return src;
    const sep = src.includes("?") ? "&" : "?";
    return `${src}${sep}_vna=${retryBust}&t=${Date.now()}`;
  }, [src, retryBust]);

  const audioKey = `${streamKey ?? ""}|${effectiveSrc}|${retryBust}`;

  useEffect(() => {
    const el = document.createElement("audio");
    let hintedMime = "";
    const s = src.trim().toLowerCase();
    if (s.startsWith("data:audio/")) {
      const m = s.match(/^data:(audio\/[a-z0-9+.-]+)/i);
      hintedMime = m?.[1]?.toLowerCase() ?? "";
    } else if (s.includes(".webm")) {
      hintedMime = "audio/webm";
    } else if (s.includes(".ogg") || s.includes(".oga")) {
      hintedMime = "audio/ogg";
    } else if (s.includes(".m4a") || s.includes(".mp4")) {
      hintedMime = "audio/mp4";
    } else if (s.includes(".mp3")) {
      hintedMime = "audio/mpeg";
    } else if (s.includes(".wav")) {
      hintedMime = "audio/wav";
    }
    if (!hintedMime) return;
    const can = el.canPlayType(hintedMime);
    setUnsupportedType(can === "");
  }, [src]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted || !el.src) return;
      try {
        el.load();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [audioKey]);

  const handleError = () => {
    setRetryBust((b) => {
      if (b >= 2) {
        setLoadFailed(true);
        return b;
      }
      return b + 1;
    });
  };

  const retryNow = () => {
    setLoadFailed(false);
    setRetryBust((b) => b + 1);
  };

  return (
    <div className="space-y-2">
      <audio
        key={audioKey}
        ref={ref}
        controls
        src={effectiveSrc}
        className={`min-h-[44px] w-full ${className ?? ""}`}
        preload="metadata"
        playsInline
        onError={handleError}
        onPlay={() => setLoadFailed(false)}
        onEnded={(e) => {
          try {
            e.currentTarget.currentTime = 0;
          } catch {
            /* ignore */
          }
        }}
      />
      {unsupportedType ? (
        <p className="text-xs font-semibold text-amber-900">
          هذا النوع من البصمة الصوتية غير مدعوم في متصفحك الحالي.
        </p>
      ) : null}
      {loadFailed ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-rose-800">تعذّر تحميل البصمة الصوتية.</p>
          <button
            type="button"
            onClick={retryNow}
            className="rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-900 hover:bg-rose-100"
          >
            إعادة المحاولة
          </button>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            فتح الصوت
          </a>
        </div>
      ) : null}
    </div>
  );
}
