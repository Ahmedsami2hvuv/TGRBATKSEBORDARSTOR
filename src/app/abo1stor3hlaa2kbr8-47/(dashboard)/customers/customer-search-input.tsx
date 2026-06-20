"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { DynamicIcon } from "@/components/dynamic-icon";
import { GlobalIconsConfig } from "@/lib/icon-settings";

export function CustomerSearchInput({ 
  defaultValue, 
  source,
  icons
}: { 
  defaultValue: string; 
  source?: string;
  icons?: GlobalIconsConfig | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== defaultValue) {
        startTransition(() => {
          const sourceParam = source && source !== "all" ? `&source=${encodeURIComponent(source)}` : "";
          if (query) {
            router.replace(`/abo1stor3hlaa2kbr8-47/customers?q=${encodeURIComponent(query)}${sourceParam}`);
          } else {
            router.replace(sourceParam ? `/abo1stor3hlaa2kbr8-47/customers?source=${encodeURIComponent(source!)}` : `/abo1stor3hlaa2kbr8-47/customers`);
          }
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, router, defaultValue]);

  return (
    <div className="flex-1 relative flex items-center w-full">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="بحث فوري في الزبائن (رقم، منطقة)..."
        className="w-full bg-gray-50 border border-gray-200 rounded-xl pr-10 pl-10 py-2.5 text-sm focus:ring-2 focus:ring-blue-400 focus:bg-white outline-none text-right transition-all"
        dir="rtl"
      />
      <div className="absolute right-3 text-gray-400 pointer-events-none flex items-center justify-center">
        <DynamicIcon config={icons?.ui_search} fallback="🔍" className="w-4 h-4" />
      </div>
      {isPending && (
        <div className="absolute left-3 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      )}
    </div>
  );
}
