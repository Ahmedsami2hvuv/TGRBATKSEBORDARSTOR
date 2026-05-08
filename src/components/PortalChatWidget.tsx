"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { showTrayNotification } from "@/lib/client-web-notification";

type Role = "admin" | "mandoub" | "preparer" | "supplier";
type AuthPayload = {
  mandoub?: { c?: string; exp?: string; s?: string };
  preparer?: { p?: string; exp?: string; s?: string };
  supplier?: { p?: string; t?: string };
};
type Contact = { role: Role; actorId: string; actorName: string };
type ThreadItem = {
  id: string;
  unreadCount: number;
  peer: Contact | null;
  lastMessage: { body: string; senderName: string; createdAt: string } | null;
};
type ChatMessage = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  senderRole: Role;
  createdAt: string;
};

function roleLabel(role: Role): string {
  if (role === "admin") return "الإدارة";
  if (role === "mandoub") return "مندوب";
  if (role === "preparer") return "مجهز";
  return "مجهز مورد";
}

export default function PortalChatWidget() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const prevUnreadRef = useRef(0);

  const isPortalPage = useMemo(
    () => pathname.startsWith("/admin") || pathname.startsWith("/mandoub") || pathname.startsWith("/preparer") || pathname.startsWith("/supplier"),
    [pathname],
  );

  const auth = useMemo<AuthPayload>(() => {
    const c = searchParams.get("c") || undefined;
    const exp = searchParams.get("exp") || undefined;
    const s = searchParams.get("s") || undefined;
    const p = searchParams.get("p") || undefined;
    const t = searchParams.get("t") || undefined;
    if (pathname.startsWith("/mandoub")) return { mandoub: { c, exp, s } };
    if (pathname.startsWith("/preparer")) return { preparer: { p, exp, s } };
    if (pathname.startsWith("/supplier")) return { supplier: { p, t } };
    return {};
  }, [pathname, searchParams]);

  const unreadTotal = useMemo(() => threads.reduce((sum, t) => sum + t.unreadCount, 0), [threads]);

  async function loadThreads() {
    const res = await fetch("/api/portal-chat/threads", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.threads)) {
      setThreads(data.threads);
      if (!selectedThreadId && data.threads[0]?.id) setSelectedThreadId(data.threads[0].id);
    }
  }

  async function loadContacts() {
    const res = await fetch("/api/portal-chat/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data.contacts)) setContacts(data.contacts);
  }

  async function loadMessages(threadId: string) {
    if (!threadId) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch("/api/portal-chat/messages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth, threadId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.messages)) setMessages(data.messages);
      await fetch("/api/portal-chat/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth, threadId }),
      });
      await loadThreads();
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function sendMessage() {
    const text = messageText.trim();
    if (!text || !selectedThreadId) return;
    setMessageText("");
    await fetch("/api/portal-chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth, threadId: selectedThreadId, text }),
    });
    await loadMessages(selectedThreadId);
  }

  async function createOrOpenThread(contact: Contact) {
    const res = await fetch("/api/portal-chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth, target: contact }),
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.threadId) {
      setSelectedThreadId(String(data.threadId));
      await loadThreads();
      await loadMessages(String(data.threadId));
    }
  }

  useEffect(() => {
    if (!isPortalPage) return;
    void loadThreads();
    void loadContacts();
    const id = window.setInterval(() => {
      void loadThreads();
      if (selectedThreadId) void loadMessages(selectedThreadId);
    }, 7000);
    return () => window.clearInterval(id);
  }, [isPortalPage, selectedThreadId]);

  useEffect(() => {
    if (!isPortalPage) return;
    const current = unreadTotal;
    const prev = prevUnreadRef.current;
    if (current > prev && "Notification" in window && Notification.permission === "granted") {
      void showTrayNotification({
        title: "رسالة جديدة",
        body: `عندك ${current} رسالة غير مقروءة`,
        tag: "portal-chat-unread",
        openUrl: `${window.location.pathname}${window.location.search}`,
      });
    }
    prevUnreadRef.current = current;
  }, [unreadTotal, isPortalPage]);

  useEffect(() => {
    if (!selectedThreadId) return;
    void loadMessages(selectedThreadId);
  }, [selectedThreadId]);

  if (!isPortalPage) return null;

  const filteredContacts = contacts.filter((c) => {
    const q = contactQuery.trim().toLowerCase();
    if (!q) return true;
    return c.actorName.toLowerCase().includes(q) || roleLabel(c.role).toLowerCase().includes(q);
  });

  return (
    <div className="fixed bottom-5 left-5 z-[9999]">
      {isOpen ? (
        <div className="h-[560px] w-[360px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <div>
              <p className="text-sm font-black text-slate-900">الدردشة</p>
              <p className="text-[11px] text-slate-500">تواصل بين الإدارة والمندوب والمجهز</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if ("Notification" in window && Notification.permission !== "granted") {
                    await Notification.requestPermission();
                  }
                }}
                className="rounded-lg border border-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-700"
              >
                تفعيل الإشعارات
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="text-xl font-bold text-slate-500">×</button>
            </div>
          </div>

          <div className="grid h-[calc(100%-49px)] grid-cols-[140px_1fr]">
            <div className="border-e border-slate-100 p-2">
              <input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="بحث..."
                className="mb-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
              />
              <div className="mb-2 max-h-[130px] overflow-auto rounded-lg border border-slate-100 p-1">
                {filteredContacts.slice(0, 20).map((c) => (
                  <button
                    key={`${c.role}-${c.actorId}`}
                    onClick={() => void createOrOpenThread(c)}
                    className="mb-1 w-full rounded-md bg-slate-50 px-2 py-1 text-right text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {c.actorName}
                    <span className="ms-1 text-[10px] text-slate-500">({roleLabel(c.role)})</span>
                  </button>
                ))}
              </div>
              <div className="max-h-[320px] overflow-auto">
                {threads.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedThreadId(t.id)}
                    className={`mb-1 w-full rounded-lg px-2 py-1 text-right ${selectedThreadId === t.id ? "bg-indigo-100" : "bg-slate-50 hover:bg-slate-100"}`}
                  >
                    <p className="truncate text-[11px] font-black text-slate-800">{t.peer?.actorName || "محادثة"}</p>
                    <p className="truncate text-[10px] text-slate-500">{t.lastMessage?.body || "..."}</p>
                    {t.unreadCount > 0 ? (
                      <span className="mt-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-black text-white">
                        {t.unreadCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex-1 space-y-2 overflow-auto p-2">
                {isLoadingMessages ? <p className="text-xs text-slate-500">جاري تحميل الرسائل...</p> : null}
                {messages.map((m) => {
                  const mine = selectedThreadId && threads.find((t) => t.id === selectedThreadId)?.peer?.actorId !== m.senderId;
                  return (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-2 py-1 text-xs ${mine ? "ms-auto bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}
                    >
                      <p className="font-bold">{m.body}</p>
                      <p className={`text-[10px] ${mine ? "text-indigo-100" : "text-slate-500"}`}>{m.senderName}</p>
                    </div>
                  );
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
                className="flex gap-2 border-t border-slate-100 p-2"
              >
                <input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="اكتب رسالة..."
                  className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                />
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-black text-white">إرسال</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative h-14 w-14 rounded-full bg-indigo-600 text-2xl text-white shadow-xl"
        title="الدردشة"
      >
        💬
        {unreadTotal > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-black text-white">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        ) : null}
      </button>
    </div>
  );
}
