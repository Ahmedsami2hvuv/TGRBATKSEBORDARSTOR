"use client";

import { useState } from "react";
import Link from "next/link";
import { preparerPath } from "@/lib/preparer-portal-nav";

type Branch = {
  id: string;
  name: string;
  photoUrl: string;
  categoryName: string;
};

type Props = {
  branches: Branch[];
  auth: { p: string; exp: string; s: string };
};

export function BranchSelectorClient({ branches, auth }: Props) {
  const [search, setSearch] = useState("");

  const filteredBranches = branches.filter((br) =>
    br.name.toLowerCase().includes(search.toLowerCase()) ||
    br.categoryName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="بحث عن فرع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-bold"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
        </div>
        {search && (
          <p className="mt-2 text-xs text-slate-500 font-bold px-2">
            تم العثور على {filteredBranches.length} فرع
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBranches.map((br) => (
          <Link
            key={br.id}
            href={preparerPath(`/preparer/store-pricing/${br.id}`, auth)}
            className="group relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50 transition-all flex items-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
              {br.photoUrl ? (
                <img src={br.photoUrl} alt={br.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                "🌿"
              )}
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{br.categoryName}</p>
              <h2 className="text-xl font-black text-slate-800">{br.name}</h2>
              <p className="text-xs text-slate-400 font-bold">تعديل أسعار {br.name}</p>
            </div>
            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-emerald-500 transition-colors">
              <span className="text-2xl">←</span>
            </div>
          </Link>
        ))}

        {filteredBranches.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-400 font-bold">
              {search ? "لا توجد نتائج تطابق بحثك" : "لا توجد أفرع مفوضة لك لتسعيرها حالياً."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
