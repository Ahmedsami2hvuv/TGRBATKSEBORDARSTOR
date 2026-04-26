"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("dark", saved === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <button
      onClick={toggle}
      className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xl transition-all active:scale-90 hover:bg-slate-200 dark:hover:bg-slate-700"
      title={theme === "light" ? "الوضع الليلي" : "الوضع النهاري"}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
