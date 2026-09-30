"use client";

import { useState, useEffect } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

interface CustomLink {
  id: string;
  name: string;
  url: string;
}

interface CustomCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  links: CustomLink[];
}

const COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#64748b"];

export function FloatingMenuSettings({ icons }: { icons?: GlobalIconsConfig | null }) {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [menuScale, setMenuScale] = useState(1);
  const [menuFontSize, setMenuFontSize] = useState(8);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Drag and drop states
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [draggedLinkIndex, setDraggedLinkIndex] = useState<number | null>(null);
  const [draggedLinkCatId, setDraggedLinkCatId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu")
      .then(res => res.json())
      .then(data => {
        if (data.categories) setCategories(data.categories);
        if (data.isLocked !== undefined) setIsLocked(data.isLocked);
        if (data.menuScale !== undefined) setMenuScale(data.menuScale);
        if (data.menuFontSize !== undefined) setMenuFontSize(data.menuFontSize);
      })
      .catch(err => console.error("Failed to fetch menu settings", err))
      .finally(() => {
        setMounted(true);
        setLoading(false);
      });
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!mounted || loading) return;

    const timeout = setTimeout(async () => {
      try {
        await fetch("/api/abo1stor3hlaa2kbr8-47/settings/floating-menu", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories, isLocked, menuScale, menuFontSize })
        });

        // Update local storage for immediate feedback in the floating menu component
        localStorage.setItem("kse_admin_floating_data", JSON.stringify(categories));
        localStorage.setItem("kse_admin_floating_locked", isLocked.toString());
        localStorage.setItem("kse_admin_floating_scale", menuScale.toString());
        localStorage.setItem("kse_admin_floating_fontsize", menuFontSize.toString());
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.error("Auto-save failed", e);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [categories, isLocked, menuScale, menuFontSize, mounted, loading]);

  const addCategory = () => {
    const newCat: CustomCategory = {
      id: Date.now().toString(),
      name: "قسم جديد",
      icon: "⭐",
      color: COLORS[categories.length % COLORS.length],
      links: []
    };
    setCategories([...categories, newCat]);
  };

  const deleteCategory = (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا القسم بجميع روابطه؟")) {
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const addLink = (catId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, links: [...c.links, { id: Date.now().toString(), name: "رابط جديد", url: "https://" }] } : c
    ));
  };

  const deleteLink = (catId: string, linkId: string) => {
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, links: c.links.filter(l => l.id !== linkId) } : c
    ));
  };

  const updateCategory = (id: string, updates: Partial<CustomCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  // Reordering categories
  const handleCatDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCatIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleCatDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCatIndex === null || draggedCatIndex === index) return;
    const newCategories = [...categories];
    const [movedCat] = newCategories.splice(draggedCatIndex, 1);
    newCategories.splice(index, 0, movedCat);
    setCategories(newCategories);
    setDraggedCatIndex(null);
  };

  const moveCategory = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[targetIndex];
    newCategories[targetIndex] = temp;
    setCategories(newCategories);
  };

  // Reordering links within a category
  const handleLinkDragStart = (e: React.DragEvent, catId: string, index: number) => {
    setDraggedLinkCatId(catId);
    setDraggedLinkIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleLinkDrop = (e: React.DragEvent, catId: string, index: number) => {
    e.preventDefault();
    if (draggedLinkIndex === null || draggedLinkCatId !== catId || draggedLinkIndex === index) return;

    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const newLinks = [...c.links];
      const [movedLink] = newLinks.splice(draggedLinkIndex, 1);
      newLinks.splice(index, 0, movedLink);
      return { ...c, links: newLinks };
    }));

    setDraggedLinkIndex(null);
    setDraggedLinkCatId(null);
  };

  const moveLink = (catId: string, index: number, direction: "up" | "down") => {
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= c.links.length) return c;
      const newLinks = [...c.links];
      const temp = newLinks[index];
      newLinks[index] = newLinks[targetIndex];
      newLinks[targetIndex] = temp;
      return { ...c, links: newLinks };
    }));
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Global Menu Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-[#0c221b]/40 p-4 rounded-2xl border border-slate-200 dark:border-[#C9A86A]/30">
        <div className="flex items-center justify-between p-2 bg-white dark:bg-[#0A3D2E]/20 rounded-xl border border-slate-100 dark:border-white/5">
          <span className="text-xs font-bold text-slate-700 dark:text-[#F5D77F]">تثبيت مكان الزر (قفل السحب)</span>
          <input
            type="checkbox"
            checked={isLocked}
            onChange={(e) => setIsLocked(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-col gap-1 p-2 bg-white dark:bg-[#0A3D2E]/20 rounded-xl border border-slate-100 dark:border-white/5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-[#F5D77F]">حجم القائمة (Scale)</span>
            <span className="text-indigo-600 dark:text-indigo-400">{Math.round(menuScale * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={menuScale}
            onChange={(e) => setMenuScale(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1 p-2 bg-white dark:bg-[#0A3D2E]/20 rounded-xl border border-slate-100 dark:border-white/5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700 dark:text-[#F5D77F]">حجم الخط (Font Size)</span>
            <span className="text-indigo-600 dark:text-indigo-400">{menuFontSize}px</span>
          </div>
          <input
            type="range"
            min="5"
            max="14"
            step="1"
            value={menuFontSize}
            onChange={(e) => setMenuFontSize(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 dark:text-[#F5D77F]">أقسام القائمة الدائرية</h3>
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
          >
            <span>+ إضافة قسم</span>
          </button>
        </div>

        {categories.length === 0 && (
          <div className="text-center py-8 bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-400">لا توجد أقسام مخصصة حالياً. اضغط على "إضافة قسم" للبدء.</p>
          </div>
        )}

        <div className="space-y-3">
          {categories.map((cat, catIndex) => (
            <div
              key={cat.id}
              draggable
              onDragStart={(e) => handleCatDragStart(e, catIndex)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleCatDrop(e, catIndex)}
              className="bg-white dark:bg-[#0c221b]/60 border border-slate-200 dark:border-[#C9A86A]/30 rounded-2xl p-4 space-y-3 shadow-xs"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <span className="cursor-move text-slate-400 hover:text-slate-600">☰</span>
                  
                  {/* Emoji / Icon Selector */}
                  <input
                    type="text"
                    value={cat.icon}
                    onChange={(e) => updateCategory(cat.id, { icon: e.target.value })}
                    className="w-10 h-10 text-center text-lg bg-slate-100 dark:bg-[#0A3D2E]/40 border border-slate-200 dark:border-[#C9A86A]/40 rounded-xl"
                    title="رمز أو إيموجي القسم"
                  />

                  {/* Name */}
                  <input
                    type="text"
                    value={cat.name}
                    onChange={(e) => updateCategory(cat.id, { name: e.target.value })}
                    placeholder="اسم القسم"
                    className="flex-1 px-3 py-2 text-xs font-bold bg-slate-50 dark:bg-[#0A3D2E]/20 border border-slate-200 dark:border-[#C9A86A]/40 rounded-xl focus:ring-1 focus:ring-indigo-500"
                  />

                  {/* Color Picker */}
                  <div className="flex items-center gap-1">
                    {COLORS.slice(0, 5).map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateCategory(cat.id, { color })}
                        className={`w-6 h-6 rounded-full transition-transform ${cat.color === color ? "scale-125 ring-2 ring-indigo-400" : ""}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveCategory(catIndex, "up")}
                    disabled={catIndex === 0}
                    className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCategory(catIndex, "down")}
                    disabled={catIndex === categories.length - 1}
                    className="p-1.5 bg-slate-100 dark:bg-white/5 rounded-lg text-xs disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={() => addLink(cat.id)}
                    className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-lg text-xs font-bold"
                  >
                    + رابط
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    className="p-1.5 bg-rose-50 text-rose-600 rounded-lg text-xs hover:bg-rose-100 transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Category Sub-Links */}
              {cat.links.length > 0 && (
                <div className="mr-8 space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  {cat.links.map((link, linkIndex) => (
                    <div
                      key={link.id}
                      draggable
                      onDragStart={(e) => handleLinkDragStart(e, cat.id, linkIndex)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleLinkDrop(e, cat.id, linkIndex)}
                      className="flex items-center gap-2 bg-slate-50 dark:bg-[#0A3D2E]/10 p-2 rounded-xl border border-slate-100 dark:border-white/5"
                    >
                      <span className="cursor-move text-slate-300 text-xs">⋮⋮</span>
                      <input
                        type="text"
                        value={link.name}
                        onChange={(e) => {
                          const newLinks = cat.links.map(l => l.id === link.id ? { ...l, name: e.target.value } : l);
                          updateCategory(cat.id, { links: newLinks });
                        }}
                        placeholder="اسم الرابط"
                        className="w-1/3 px-2 py-1 bg-white dark:bg-[#0A3D2E]/30 text-xs font-bold border border-slate-200 dark:border-[#C9A86A]/30 rounded-lg"
                      />
                      <input
                        type="text"
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = cat.links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l);
                          updateCategory(cat.id, { links: newLinks });
                        }}
                        placeholder="https://..."
                        className="flex-1 px-2 py-1 bg-white dark:bg-[#0A3D2E]/30 text-xs font-mono border border-slate-200 dark:border-[#C9A86A]/30 rounded-lg text-left dir-ltr"
                      />
                      <button
                        type="button"
                        onClick={() => moveLink(cat.id, linkIndex, "up")}
                        disabled={linkIndex === 0}
                        className="p-1 bg-white dark:bg-white/5 rounded text-[10px] disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLink(cat.id, linkIndex, "down")}
                        disabled={linkIndex === cat.links.length - 1}
                        className="p-1 bg-white dark:bg-white/5 rounded text-[10px] disabled:opacity-30"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(cat.id, link.id)}
                        className="text-rose-500 hover:text-rose-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
