"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "auto",
  setTheme: () => null,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("auto");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("kse-theme") as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "auto") {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem("kse-theme", mode);
  };

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;

    const applyTheme = () => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        const hour = new Date().getHours();
        const isNight = hour >= 18 || hour < 6;
        if (isNight) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    };

    applyTheme();

    if (theme === "auto") {
      const id = setInterval(applyTheme, 60000);
      return () => clearInterval(id);
    }
  }, [theme, mounted]);

  // Avoid flash if possible by rendering immediately but suppressing hydration mismatch.
  // We'll just render it normally, but the html tag must have suppressHydrationWarning
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
