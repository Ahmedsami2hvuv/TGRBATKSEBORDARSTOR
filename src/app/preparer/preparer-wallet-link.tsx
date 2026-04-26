import Link from "next/link";
import { preparerPath } from "@/lib/preparer-portal-nav";

export function PreparerWalletLink({
  auth,
}: {
  auth: { p: string; exp: string; s: string };
}) {
  return (
    <Link
      href={preparerPath("/preparer/wallet", auth)}
      className="inline-flex w-full items-center justify-center rounded-xl border-2 border-violet-400 bg-violet-50 px-3 py-2 text-center text-sm font-black text-violet-950 shadow-sm hover:bg-violet-100 sm:w-auto sm:px-4 sm:py-3"
    >
      محفظتي
    </Link>
  );
}
