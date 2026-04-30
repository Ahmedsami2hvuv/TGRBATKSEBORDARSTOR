import Link from "next/link";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { useEffect, useState } from "react";
import { getGlobalIcons, GlobalIconsConfig } from "@/lib/icon-settings";
import { DynamicIcon } from "@/components/dynamic-icon";

export function PreparerWalletLink({
  auth,
}: {
  auth: { p: string; exp: string; s: string };
}) {
  const [icons, setIcons] = useState<GlobalIconsConfig | null>(null);

  useEffect(() => {
    getGlobalIcons().then(setIcons);
  }, []);

  return (
    <Link
      href={preparerPath("/preparer/wallet", auth)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-400 bg-violet-50 px-3 py-2 text-center text-sm font-black text-violet-950 shadow-sm hover:bg-violet-100 sm:w-auto sm:px-4 sm:py-3"
    >
      <DynamicIcon
        iconKey="wallet"
        config={icons}
        className="h-5 w-5"
        fallback={<span>👛</span>}
      />
      محفظتي
    </Link>
  );
}
