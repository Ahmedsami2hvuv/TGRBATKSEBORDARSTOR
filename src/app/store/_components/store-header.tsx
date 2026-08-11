"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export function StoreHeader() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        router.push(`/store/search?q=${encodeURIComponent(value.trim())}`);
      }
    }, 1000); // 1 second debounce
  };

  return (
    <header className="sticky top-0 z-50 bg-white pt-4 pb-2 px-4 shadow-sm relative border-b border-slate-100">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-4">
        {/* زر القائمة - يسار */}
        <Link href="/store/categories" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </Link>
        
        {/* اسم الستور - في الوسط */}
        <div className="flex flex-col items-center justify-center flex-1 mx-2">
          <span className="text-sm md:text-lg font-black text-green-600 line-clamp-1">خصيب ستور ابو الاكبر</span>
        </div>

        {/* زر الرئيسية - يمين */}
        <Link href="/store" prefetch={true} className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </Link>
      </div>
      
      {/* شريط البحث */}
      <div className="max-w-7xl mx-auto flex items-center gap-2">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="بحث عن منتج..." 
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full h-12 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all" 
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </header>
  );
}
