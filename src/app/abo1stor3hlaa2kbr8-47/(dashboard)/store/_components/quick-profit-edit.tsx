"use client";

import { useState } from "react";
import { upsertCategory, upsertBranch } from "../actions";

interface QuickProfitEditProps {
  id: string;
  initialMargin: number;
  type: "category" | "branch";
  name: string;
  categoryId?: string; // مطلوب للأفرع
}

export function QuickProfitEdit({ id, initialMargin, type, name, categoryId }: QuickProfitEditProps) {
  const [margin, setMargin] = useState(initialMargin);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSave() {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("id", id);
      formData.append("name", name);
      formData.append("profitMargin", String(margin));

      if (type === "category") {
          await upsertCategory(null, formData);
      } else {
          if (!categoryId) {
              alert("خطأ: معرف القسم مطلوب لتحديث الفرع");
              return;
          }
          formData.append("categoryId", categoryId);
          await upsertBranch(null, formData);
      }

      setIsEditing(false);
    } catch (e) {
      alert("فشل التحديث السريع");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="text-[10px] text-emerald-600 font-black hover:bg-emerald-50 px-2 py-0.5 rounded-lg transition-colors"
        >
          💰 +{Number(margin).toLocaleString()}
        </button>
        {Number(margin) > 0 && (
          <button
            disabled={isLoading}
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsLoading(true);
              try {
                const formData = new FormData();
                formData.append("id", id);
                formData.append("name", name);
                formData.append("profitMargin", "0");

                if (type === "category") {
                    await upsertCategory(null, formData);
                } else {
                    if (!categoryId) return;
                    formData.append("categoryId", categoryId);
                    await upsertBranch(null, formData);
                }
                setMargin(0);
              } catch (err) {
                alert("فشل إيقاف الربح");
              } finally {
                setIsLoading(false);
              }
            }}
            className="text-[9px] bg-rose-50 hover:bg-rose-100 text-rose-500 font-black px-1.5 py-0.5 rounded transition-colors"
            title="تصفير هامش الربح"
          >
            📴 إيقاف الربح
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        type="number"
        value={margin}
        onChange={(e) => setMargin(Number(e.target.value))}
        className="w-16 px-1 py-0.5 text-[10px] font-black border border-emerald-200 rounded bg-white outline-none focus:ring-1 focus:ring-emerald-500"
        autoFocus
        onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
        }}
      />
      <button
        disabled={isLoading}
        onClick={handleSave}
        className="text-[10px] bg-emerald-500 text-white w-5 h-5 flex items-center justify-center rounded hover:bg-emerald-600 disabled:opacity-50"
      >
        {isLoading ? ".." : "✓"}
      </button>
    </div>
  );
}
