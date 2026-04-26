import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Props = {
  id: string;
  placeholder: string;
  className: string;
  ariaLabel: string;
};

export function AdminLiveSearchInput({
  id,
  placeholder,
  className,
  ariaLabel,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const initialQ = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  }, [pathname]);
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    setQ(initialQ);
  }, [initialQ, pathname]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    if (!value) {
      router.push("/admin/search");
    } else {
      router.push(`/admin/search?q=${encodeURIComponent(value)}`);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-wrap gap-2">
      <label className="sr-only" htmlFor={id}>
        {ariaLabel}
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <button type="submit" className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-700">
        بحث
      </button>
    </form>
  );
}
