"use client";

import React from "react";
import { createPortal } from "react-dom";

export type ModalActionType = "call" | "chat" | "location" | "door";

export interface ModalActionOption {
  title: string;
  subtitle?: string;
  icon: string;
  badge?: string;
  actionUrl?: string;
  onClick?: () => void;
  imageUrl?: string;
  colorVariant?: "emerald" | "amber" | "blue" | "gold";
}

interface MandoubActionMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  type: ModalActionType;
  options: ModalActionOption[];
  previewImageUrl?: string | null;
  onClosePreviewImage?: () => void;
}

export function MandoubActionMenuModal({
  isOpen,
  onClose,
  title,
  subtitle,
  type,
  options,
  previewImageUrl,
  onClosePreviewImage,
}: MandoubActionMenuModalProps) {
  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-sm rounded-[24px] p-5 sm:p-6 shadow-2xl border-2 border-[#C9A86A] bg-[#0A1A18] text-white flex flex-col gap-4 select-none animate-in zoom-in-95 duration-200"
        style={{
          boxShadow: "0 20px 50px rgba(0,0,0,0.85), inset 0 0 35px rgba(201,168,106,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق ✕ في الأعلى */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 left-3.5 w-8 h-8 rounded-full bg-[#132A26] border border-[#C9A86A]/40 text-[#F5D77F] hover:bg-[#C9A86A] hover:text-[#0A1A18] flex items-center justify-center font-black text-sm transition active:scale-90"
        >
          ✕
        </button>

        {/* رأس النافذة المنبثقة */}
        <div className="text-center pt-1 pb-1">
          <h3 className="text-base sm:text-lg font-black text-[#F5D77F] drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-300 font-bold mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* قائمة الخيارات التفاعلية */}
        <div className="flex flex-col gap-2.5">
          {options.map((opt, idx) => {
            const btnContent = (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                    {opt.icon}
                  </span>
                  <div className="flex flex-col text-right min-w-0">
                    <span className="text-sm font-black text-white leading-snug truncate">
                      {opt.title}
                    </span>
                    {opt.subtitle && (
                      <span className="text-[11px] font-mono font-bold text-[#F5D77F] truncate">
                        {opt.subtitle}
                      </span>
                    )}
                  </div>
                </div>
                {opt.badge && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#C9A86A]/20 text-[#F5D77F] border border-[#C9A86A]/40 shrink-0">
                    {opt.badge}
                  </span>
                )}
              </div>
            );

            const baseStyle =
              "w-full rounded-xl p-3 sm:p-3.5 border transition flex items-center justify-between cursor-pointer active:scale-98 shadow-md ";
            
            let colorStyle = "bg-gradient-to-r from-[#132A26] to-[#1E3E39] border-[#C9A86A]/40 hover:border-[#C9A86A] text-white ";
            if (opt.colorVariant === "emerald") {
              colorStyle = "bg-gradient-to-r from-[#0E382B] to-[#164E3D] border-[#10B981]/50 hover:border-[#10B981] ";
            } else if (opt.colorVariant === "amber") {
              colorStyle = "bg-gradient-to-r from-[#38260E] to-[#4E3516] border-[#F59E0B]/50 hover:border-[#F59E0B] ";
            }

            if (opt.actionUrl) {
              return (
                <a
                  key={idx}
                  href={opt.actionUrl}
                  target={opt.actionUrl.startsWith("http") ? "_blank" : undefined}
                  rel={opt.actionUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                  onClick={() => {
                    if (opt.onClick) opt.onClick();
                    onClose();
                  }}
                  className={baseStyle + colorStyle}
                >
                  {btnContent}
                </a>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (opt.onClick) opt.onClick();
                  onClose();
                }}
                className={baseStyle + colorStyle}
              >
                {btnContent}
              </button>
            );
          })}
        </div>

        {/* في حال معاينة صورة الباب */}
        {previewImageUrl && (
          <div className="mt-2 rounded-xl overflow-hidden border border-[#C9A86A] bg-black relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImageUrl}
              alt="صورة الباب"
              className="w-full max-h-64 object-contain mx-auto"
            />
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
