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

export function FloatingMenuSettings({ icons }: { icons: GlobalIconsConfig }) {
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
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
           <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isLocked}
                onChange={e => setIsLocked(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-sm font-black text-slate-800">قفل موضع القائمة</span>
           </label>
           <p className="text-[10px] text-slate-500 mt-1">يمنع سحب القائمة وتغيير مكانها بالخطأ.</p>
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
           <label className="block text-sm font-black text-slate-800 mb-2">حجم القائمة ({menuScale}x)</label>
           <input
              type="range" min="0.5" max="1.5" step="0.1"
              value={menuScale}
              onChange={e => setMenuScale(parseFloat(e.target.value))}
              className="w-full"
           />
        </div>
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
           <label className="block text-sm font-black text-slate-800 mb-2">حجم الخط ({menuFontSize}px)</label>
           <input
              type="range" min="6" max="16" step="1"
              value={menuFontSize}
              onChange={e => setMenuFontSize(parseInt(e.target.value))}
              className="w-full"
           />
        </div>
      </div>

      <div className="space-y-4">
        {/* بطاقة زر الذكاء الاصطناعي الثابت */}
        <div className="p-3.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200/80 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white text-base shadow-sm shrink-0">
              ✨
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                المساعد الذكي (الذكاء الاصطناعي)
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">زر ثابت دائم</span>
              </h4>
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                مدمج وثابت تلقائياً كأول زر في القائمة الدائرية العائمة لتنفيذ الأوامر الصوتية والنصية.
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl shrink-0">
            مفعل دائماً ✓
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
            الأقسام والروابط المخصصة
            {!loading && <span className="text-[10px] text-emerald-500 font-bold bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">● مزامنة تلقائية</span>}
          </h3>
          <button
            onClick={addCategory}
            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
          >
            + إضافة قسم
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              draggable
              onDragStart={(e) => handleCatDragStart(e, idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleCatDrop(e, idx)}
              className={`border rounded-2xl overflow-hidden bg-white shadow-sm transition-all ${
                draggedCatIndex === idx
                  ? "opacity-50 border-indigo-400 border-dashed scale-[0.99]"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  {/* Category Drag Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-indigo-600 transition"
                    title="اسحب لترتيب القسم"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </div>
                  
                  {/* Category Reorder Buttons */}
                  <div className="flex flex-col -space-y-1">
                    <button
                      onClick={() => moveCategory(idx, "up")}
                      disabled={idx === 0}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition"
                      title="تحريك لأعلى"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveCategory(idx, "down")}
                      disabled={idx === categories.length - 1}
                      className="text-[10px] text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition"
                      title="تحريك لأسفل"
                    >
                      ▼
                    </button>
                  </div>

                  <div
                    className="w-4 h-4 rounded-full border border-black/10 cursor-pointer shrink-0"
                    style={{ backgroundColor: cat.color }}
                    onClick={() => {
                        const nextColor = COLORS[(COLORS.indexOf(cat.color) + 1) % COLORS.length];
                        updateCategory(cat.id, { color: nextColor });
                    }}
                  />
                  <input
                    value={cat.name}
                    onChange={e => updateCategory(cat.id, { name: e.target.value })}
                    className="bg-transparent border-none p-0 text-sm font-black text-slate-800 focus:ring-0 w-32"
                  />
                  <input
                    value={cat.icon}
                    onChange={e => {
                        const val = e.target.value;
                        const folderEmojis = ["📂", "📁", "🗂️", "💼", "🗄️"];
                        if (!folderEmojis.includes(val.trim())) {
                            updateCategory(cat.id, { icon: val });
                        }
                    }}
                    placeholder="Emoji"
                    className="bg-transparent border-none p-0 text-center text-sm focus:ring-0 w-10"
                  />
                </div>
                <button onClick={() => deleteCategory(cat.id)} className="text-rose-500 p-1 hover:bg-rose-50 rounded-lg transition">
                  <DynamicIcon iconKey="ui_trash" config={icons} className="w-4 h-4" fallback={<span>🗑️</span>} />
                </button>
              </div>

              <div className="p-3 space-y-2">
                {cat.links.map((link, lIdx) => (
                  <div
                    key={link.id}
                    draggable
                    onDragStart={(e) => handleLinkDragStart(e, cat.id, lIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleLinkDrop(e, cat.id, lIdx)}
                    className={`flex items-center gap-2 group p-1 rounded-xl transition-all border border-transparent ${
                      draggedLinkIndex === lIdx && draggedLinkCatId === cat.id
                        ? "bg-indigo-50/50 border-dashed border-indigo-200 opacity-40"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Link Drag Handle */}
                    <div
                      className="cursor-grab active:cursor-grabbing p-1 text-slate-350 hover:text-indigo-600 transition shrink-0"
                      title="اسحب لترتيب الرابط"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm6 0a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-6 6a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm6 0a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm-6 6a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm6 0a2 2 0 1 1-2 2 2 2 0 0 1 2-2z" />
                      </svg>
                    </div>

                    {/* Link Reorder Buttons */}
                    <div className="flex flex-col -space-y-1.5 shrink-0">
                      <button
                        onClick={() => moveLink(cat.id, lIdx, "up")}
                        disabled={lIdx === 0}
                        className="text-[9px] text-slate-350 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-350 transition"
                        title="تحريك لأعلى"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveLink(cat.id, lIdx, "down")}
                        disabled={lIdx === cat.links.length - 1}
                        className="text-[9px] text-slate-350 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-350 transition"
                        title="تحريك لأسفل"
                      >
                        ▼
                      </button>
                    </div>

                    <input
                      value={link.name}
                      onChange={e => {
                        setCategories(prev => prev.map(c => c.id === cat.id ? {
                           ...c, links: c.links.map(l => l.id === link.id ? { ...l, name: e.target.value } : l)
                        } : c));
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:border-indigo-400 outline-none"
                    />
                    <input
                      value={link.url}
                      onChange={e => {
                        setCategories(prev => prev.map(c => c.id === cat.id ? {
                           ...c, links: c.links.map(l => l.id === link.id ? { ...l, url: e.target.value } : l)
                        } : c));
                      }}
                      className="flex-[2] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-500 focus:border-indigo-400 outline-none"
                    />
                    <button onClick={() => deleteLink(cat.id, link.id)} className="text-slate-400 hover:text-rose-500 transition shrink-0">
                      <DynamicIcon iconKey="ui_close" config={icons} className="w-3 h-3" fallback={<span>×</span>} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addLink(cat.id)}
                  className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 transition"
                >
                  + إضافة رابط لـ {cat.name}
                </button>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
               <p className="text-sm text-slate-400 font-bold">لا يوجد أقسام مضافة بعد.</p>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-4">
          <p className="text-xs text-slate-500 font-bold animate-bounce">جاري جلب البيانات من السحابة...</p>
        </div>
      )}
    </div>
  );
}
