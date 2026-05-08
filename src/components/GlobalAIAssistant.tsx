"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; payload: any };
  actions?: { type: string; payload: any }[];
};

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [fabPosition, setFabPosition] = useState({ x: 24, y: 24 });
  const [isDraggingFab, setIsDraggingFab] = useState(false);
  const pathname = usePathname();
  const isVisiblePortal =
    pathname.includes("/admin") ||
    pathname.includes("/preparer") ||
    pathname.includes("/mandoub") ||
    pathname.includes("/store") ||
    pathname === "/";

  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const fabPositionRef = useRef(fabPosition);
  const ignoreNextClickRef = useRef(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("kse:ai:floating-pos");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const x = Number(parsed?.x);
      const y = Number(parsed?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        setFabPosition({ x, y });
      }
    } catch {
      // ignore storage parse issues
    }
  }, []);

  useEffect(() => {
    const welcomeMsg = getWelcomeMessage(pathname);
    setMessages([{ role: "assistant", content: welcomeMsg }]);
  }, [pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    fabPositionRef.current = fabPosition;
  }, [fabPosition]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (activePointerIdRef.current == null || e.pointerId !== activePointerIdRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (!isDraggingFab && Math.hypot(dx, dy) < 6) return;
      if (!isDraggingFab) setIsDraggingFab(true);
      const nextX = Math.max(8, Math.min(window.innerWidth - 64 - 8, e.clientX - dragOffsetRef.current.x));
      const nextY = Math.max(8, Math.min(window.innerHeight - 64 - 8, e.clientY - dragOffsetRef.current.y));
      setFabPosition({ x: nextX, y: nextY });
    };

    const onUp = (e: PointerEvent) => {
      if (activePointerIdRef.current == null || e.pointerId !== activePointerIdRef.current) return;
      activePointerIdRef.current = null;
      if (!isDraggingFab) return;
      setIsDraggingFab(false);
      ignoreNextClickRef.current = true;
      try {
        sessionStorage.setItem("kse:ai:floating-pos", JSON.stringify(fabPositionRef.current));
      } catch {
        // ignore storage failure
      }
      setTimeout(() => {
        ignoreNextClickRef.current = false;
      }, 120);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isDraggingFab]);

  function getWelcomeMessage(path: string) {
    if (path.includes("/admin")) return "أهلاً سيادة المدير. كيف يمكنني مساعدتك في إدارة النظام اليوم؟";
    if (path.includes("/preparer")) return "أهلاً بك في بوابة التجهيز. هل تريد البحث عن طلب معين لتجهيزه؟";
    if (path.includes("/mandoub")) return "أهلاً بطل الميدان! كيف حالك اليوم؟";
    return "أهلاً بك في متجر أبو الأكبر. ماذا تحب أن تطلب اليوم؟";
  }

  const handleSend = async (forcedInput?: string) => {
    const finalInput = (forcedInput ?? input).trim();
    if (!finalInput) return;

    const userMsg = finalInput;
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    if (!forcedInput) setInput("");

    const pageContext = {
      path: pathname,
      role: pathname.includes("/admin") ? "admin" :
            pathname.includes("/preparer") ? "preparer" :
            pathname.includes("/mandoub") ? "courier" : "customer",
      isStore: pathname.includes("/store") || pathname === "/"
    };

    setMessages(prev => [...prev, { role: "assistant", content: "لحظة وحدة..." }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMsg,
          history: messages.slice(-5),
          context: pageContext
        }),
      });

      const data = await response.json();
      const parsedActions: { type: string; payload: any }[] = Array.isArray(data.actions)
        ? data.actions
        : data.action
          ? [data.action]
          : [];

      for (const action of parsedActions) {
        handleAIAction(action, pageContext.role);
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
            role: "assistant",
            content: data.text,
            action: parsedActions[0],
            actions: parsedActions.length > 0 ? parsedActions : undefined
        };
        return newMsgs;
      });
    } catch (error) {
      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = { role: "assistant", content: "واجهت مشكلة صغيرة، جرب مرة ثانية." };
        return newMsgs;
      });
    }
  };

  const handleAIAction = (action: { type: string; payload: any }, role: string) => {
    console.log("AI executing action:", action, "for role:", role);

    switch (action.type) {
      case "OPEN_ORDER":
        if (role === "admin") {
          router.push(`/admin/orders/${action.payload.orderId}/edit`);
        } else if (role === "preparer") {
          // المجهز يفتح صفحة التجهيز
          router.push(`/preparer/preparation?orderId=${action.payload.orderId}`);
        }
        break;
      case "SEARCH_PRODUCTS":
        router.push(`/store/search?q=${encodeURIComponent(action.payload.query)}`);
        break;
      case "NAVIGATE":
        const targetUrl = action.payload.url;
        if (targetUrl && !targetUrl.startsWith("http")) {
            router.push(targetUrl);
        }
        break;
      case "ADD_TO_CART":
        window.dispatchEvent(new CustomEvent("add-to-cart", { detail: action.payload }));
        break;
      case "CREATE_CUSTOMER_REFERENCE":
      case "CREATE_PREPARATION_DRAFT":
      case "ASSIGN_ORDER_TO_COURIER":
      case "PROMPT_ASSIGN_COURIER_FOR_GROUP":
      case "ASSIGN_COURIER_TO_DRAFT_GROUP":
      case "SKIP_COURIER_ASSIGN":
        if (role === "admin") {
          void executeChatAction(action);
        }
        break;
      case "OPEN_CUSTOMER":
        if (role === "admin") {
          const phone = String(action.payload?.phone || "").trim();
          const regionId = String(action.payload?.regionId || "").trim();
          if (phone) {
            const q = new URLSearchParams();
            q.set("phone", phone);
            if (regionId) q.set("regionId", regionId);
            q.set("source", "ai");
            router.push(`/admin/customers/info?${q.toString()}`);
          }
        }
        break;
      case "NAVIGATE_ADMIN_PENDING_ASSIGN":
        if (role === "admin") {
          const orderId = String(action.payload?.orderId || "").trim();
          if (orderId) router.push(`/admin/orders/pending?assignOrder=${encodeURIComponent(orderId)}`);
        }
        break;
      default:
        console.warn("Unknown action:", action.type);
    }
  };

  const executeChatAction = async (action: { type: string; payload: any }) => {
    try {
      setMessages((prev) => [...prev, { role: "assistant", content: "جاري تنفيذ الطلب..." }]);
      const res = await fetch("/api/chat/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: String(data?.text || "اكتمل التنفيذ."),
          actions: Array.isArray(data?.actions) ? data.actions : undefined,
        };
        return next;
      });
    } catch {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: "صار خطأ بالتنفيذ، جرّب مرة ثانية." };
        return next;
      });
    }
  };

  const quickReplyFromOption = (item: any) => {
    if (item?.action && typeof item.action === "object") {
      return JSON.stringify(item.action);
    }
    const id = String(item?.id || "").trim();
    const name = String(item?.name || item?.label || "").trim();
    const title = String(item?.title || "").trim();
    return [title || name || id, id].filter(Boolean).join(" | ");
  };

  const sendQuickReply = async (text: string) => {
    if (!text.trim()) return;
    if (text.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(text);
        if (parsed?.type) {
          const role =
            pathname.includes("/admin")
              ? "admin"
              : pathname.includes("/preparer")
                ? "preparer"
                : pathname.includes("/mandoub")
                  ? "courier"
                  : "customer";
          const localTypes = new Set([
            "OPEN_ORDER",
            "SEARCH_PRODUCTS",
            "NAVIGATE",
            "ADD_TO_CART",
            "OPEN_CUSTOMER",
            "NAVIGATE_ADMIN_PENDING_ASSIGN",
          ]);
          if (localTypes.has(String(parsed.type))) {
            handleAIAction(parsed, role);
          } else {
            await executeChatAction(parsed);
          }
          return;
        }
      } catch {
        // fallback to normal chat send
      }
    }
    await handleSend(text);
  };

  const startFabDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const toggleFabOpen = () => {
    if (ignoreNextClickRef.current) return;
    setIsOpen(!isOpen);
  };

  if (!isVisiblePortal) return null;

  return (
    <div
      className="fixed z-[9999] flex flex-col items-end"
      style={{
        right: `${fabPosition.x}px`,
        bottom: `${fabPosition.y}px`,
      }}
    >
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 h-[500px] bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-xl">🤖</div>
              <div>
                <h3 className="font-black text-sm">مساعد أبو الأكبر الذكي</h3>
                <p className="text-[10px] text-white/70">متصل بصفحة {pathname}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto bg-slate-50 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed font-bold shadow-sm ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white self-end rounded-tr-none"
                    : "bg-white text-slate-700 self-start rounded-tl-none border border-slate-100"
                }`}
              >
                {m.content}
                {m.action && (
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-emerald-600 flex items-center gap-1">
                    <span>⚡ تم تنفيذ: {actionName(m.action.type)}</span>
                  </div>
                )}
                {Array.isArray(m.actions) &&
                  m.actions.some((a) => a.type === "SHOW_OPTIONS" && Array.isArray(a.payload?.items)) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {m.actions
                        .filter((a) => a.type === "SHOW_OPTIONS")
                        .flatMap((a) => (Array.isArray(a.payload?.items) ? a.payload.items : []))
                        .slice(0, 8)
                        .map((item: any, idx: number) => (
                          <button
                            key={`${idx}-${String(item?.id || item?.name || "opt")}`}
                            onClick={() => sendQuickReply(quickReplyFromOption(item))}
                            className="rounded-xl border border-indigo-200 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
                          >
                            {String(item?.title || item?.name || item?.label || item?.id || "خيار")}
                          </button>
                        ))}
                    </div>
                  )}
              </div>
            ))}
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسألني أي شيء..."
                className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
              />
              <button type="submit" className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        onPointerDown={startFabDrag}
        onClick={toggleFabOpen}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all duration-300 ${
          isOpen ? "bg-slate-800" : "bg-indigo-600"
        }`}
        style={{ touchAction: "none", cursor: isDraggingFab ? "grabbing" : "grab" }}
      >
        {isOpen ? <span className="text-white">✕</span> : <span>🤖</span>}
      </button>
    </div>
  );
}

function actionName(type: string) {
    if (type === "OPEN_ORDER") return "فتح الطلب";
    if (type === "SEARCH_PRODUCTS") return "البحث عن منتجات";
    if (type === "NAVIGATE") return "تنقل";
    if (type === "OPEN_CUSTOMER") return "فتح ملف زبون";
    if (type === "NAVIGATE_ADMIN_PENDING_ASSIGN") return "فتح إسناد الطلب";
    if (type === "ADD_TO_CART") return "إضافة للسلة";
    if (type === "CREATE_PREPARATION_DRAFT") return "إنشاء طلب تجهيز";
    if (type === "PROMPT_ASSIGN_COURIER_FOR_GROUP") return "اختيار إسناد مندوب";
    if (type === "ASSIGN_COURIER_TO_DRAFT_GROUP") return "تعيين مندوب";
    return type;
}
