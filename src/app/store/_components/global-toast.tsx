"use client";

import { useEffect, useState } from "react";

export function GlobalToast() {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; id: number } | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      const { message, type = "success" } = e.detail || {};
      setToast({ message: message || "عاشت ايدك، تمت الإضافة للسلة!", type, id: Date.now() });
      
      setTimeout(() => {
        setToast(null);
      }, 3000);
    };

    window.addEventListener("kse:show-toast", handleToast);
    return () => window.removeEventListener("kse:show-toast", handleToast);
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-5 duration-300 pointer-events-none">
      <div className={`flex items-center gap-2 px-6 py-3 rounded-full shadow-lg text-sm font-bold border ${
        toast.type === "success" 
        ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/20" 
        : "bg-rose-500 text-white border-rose-600 shadow-rose-500/20"
      }`}>
        <span className="text-xl">{toast.type === "success" ? "🎉" : "⚠️"}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
