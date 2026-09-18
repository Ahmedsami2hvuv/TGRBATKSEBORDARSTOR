"use client";

import React, { useEffect, useRef, useState } from "react";

type LiveCameraModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
};

export function LiveCameraModal({
  isOpen,
  onClose,
  onCapture,
  title = "التقاط صورة بالكاميرا",
}: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // إيقاف بث الكاميرا عند الخروج
  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // تشغيل الكاميرا الحية
  const startCamera = async (facing: "environment" | "user") => {
    setIsInitializing(true);
    setCameraError(null);
    stopStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("المتصفح لا يدعم الوصول المباشر للكاميرا");
      }

      // فحص عدد الكاميرات المتاحة
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {}

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn("تعذر فتح الكاميرا المباشرة:", err);
      // محاولة بديلة بدون قيود دقة
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "يرجى منح إذن الوصول للكاميرا في إعدادات المتصفح"
            : "تعذر تشغيل الكاميرا على هذا الجهاز"
        );
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCapturedBlob(null);
      setCapturedFile(null);
      void startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // تبديل الكاميرا (أمامية / خلفية)
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // التقاط الصورة الحالية
  const handleTakePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // إذا كانت كاميرا أمامية نعكس الصورة أفقياً لتبدو طبيعية كمرآة
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedBlob(previewUrl);
        setCapturedFile(file);
      },
      "image/jpeg",
      0.92
    );
  };

  // إعادة التقاط الصورة
  const handleRetake = () => {
    if (capturedBlob) {
      URL.revokeObjectURL(capturedBlob);
    }
    setCapturedBlob(null);
    setCapturedFile(null);
  };

  // تأكيد واستخدام الصورة
  const handleConfirm = () => {
    if (!capturedFile) return;
    onCapture(capturedFile);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
      dir="rtl"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* شريط العنوان والأزرار العلوية */}
      <div className="w-full max-w-lg flex items-center justify-between z-20 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#E8C77E] to-[#C9A86A] flex items-center justify-center shadow-md">
            <svg
              className="w-4 h-4 text-[#0A3D2E]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3.2" />
            </svg>
          </div>
          <span className="text-white font-black text-sm sm:text-base drop-shadow-md">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* زر تبديل الكاميرا إذا كانت الكاميرا حية */}
          {!capturedBlob && hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleFacingMode}
              title="تبديل الكاميرا (أمامية / خلفية)"
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center active:scale-90 transition cursor-pointer border border-white/20"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          )}

          {/* زر الإغلاق */}
          <button
            type="button"
            onClick={onClose}
            title="إغلاق الكاميرا"
            className="w-9 h-9 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white font-black flex items-center justify-center active:scale-90 transition cursor-pointer border border-rose-400"
          >
            ✕
          </button>
        </div>
      </div>

      {/* منطقة عرض الفيديو الحي أو الصورة الملتقطة */}
      <div className="w-full max-w-lg flex-1 my-3 relative rounded-[24px] border-[2.5px] border-[#C9A86A] overflow-hidden bg-black flex items-center justify-center shadow-[0_10px_35px_rgba(0,0,0,0.6)]">
        {/* إطار زوايا مذهبة فاخرة */}
        <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#E8C77E] pointer-events-none z-10" />
        <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#E8C77E] pointer-events-none z-10" />
        <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#E8C77E] pointer-events-none z-10" />
        <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#E8C77E] pointer-events-none z-10" />

        {/* عرض الصورة الملتقطة */}
        {capturedBlob ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={capturedBlob}
            alt="الصورة الملتقطة"
            className="w-full h-full object-contain"
          />
        ) : (
          /* عرض بث الكاميرا الحية */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              }`}
            />
            {isInitializing && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-white">
                <div className="w-8 h-8 border-3 border-[#E8C77E] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-[#E8C77E]">جارٍ تشغيل الكاميرا الحية...</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-black/85 p-6 flex flex-col items-center justify-center text-center gap-3">
                <span className="text-3xl">⚠️</span>
                <p className="text-sm font-black text-rose-300 max-w-xs">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => void startCamera(facingMode)}
                  className="mt-2 px-4 py-2 rounded-xl gold-grad text-[#0A3D2E] font-black text-xs shadow-md active:scale-95"
                >
                  🔄 إعادة المحاولة
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* شريط التحكم السفلي */}
      <div className="w-full max-w-lg pb-2 z-20">
        {capturedBlob ? (
          /* أزرار التأكيد أو إعادة الالتقاط */
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleRetake}
              className="h-[48px] rounded-[14px] bg-white/20 hover:bg-white/30 text-white font-black text-sm border border-white/30 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span>إعادة التقاط</span>
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className="h-[48px] rounded-[14px] bg-gradient-to-r from-[#E8C77E] via-[#D5B066] to-[#C9A86A] text-[#0A3D2E] font-black text-sm border border-[#9C7D46]/40 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(201,168,106,0.5)] active:scale-95 transition cursor-pointer"
            >
              <svg className="w-4 h-4 text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>تأكيد واستخدام الصورة</span>
            </button>
          </div>
        ) : (
          /* زر الالتقاط الفاخر */
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={isInitializing || Boolean(cameraError)}
              title="التقاط الصورة الآن"
              className="w-[72px] h-[72px] rounded-full gold-grad border-[3.5px] border-white shadow-[0_0_25px_rgba(201,168,106,0.7),inset_0_2px_4px_rgba(255,255,255,0.8)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer disabled:opacity-50"
            >
              <div className="w-[54px] h-[54px] rounded-full border-2 border-[#0A3D2E] bg-white flex items-center justify-center shadow-inner">
                <div className="w-[42px] h-[42px] rounded-full gold-grad flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0A3D2E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
