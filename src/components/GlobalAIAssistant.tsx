"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; payload: any };
};

export default function GlobalAIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const welcomeMsg = getWelcomeMessage(pathname);
    setMessages([{ role: "assistant", content: welcomeMsg }]);
  }, [pathname]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function getWelcomeMessage(path: string) {
    if (path.includes("/admin")) return "أهلاً سيادة المدير. كيف يمكنني مساعدتك في إدارة النظام اليوم؟";
    if (path.includes("/preparer")) return "أهلاً بك في بوابة التجهيز. هل تريد البحث عن طلب معين لتجهيزه؟";
    if (path.includes("/mandoub")) return "أهلاً بطل الميدان! كيف حالك اليوم؟";
    return "أهلاً بك في متجر أبو الأكبر. ماذا تحب أن تطلب اليوم؟";
  }

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");

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

      if (data.action) {
        handleAIAction(data.action, pageContext.role);
      }

      setMessages(prev => {
        const newMsgs = [...prev];
        newMsgs[newMsgs.length - 1] = {
            role: "assistant",
            content: data.text,
            action: data.action
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
      default:
        console.warn("Unknown action:", action.type);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
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
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all duration-300 ${
          isOpen ? "bg-slate-800" : "bg-indigo-600"
        }`}
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
    if (type === "ADD_TO_CART") return "إضافة للسلة";
    return type;
}
