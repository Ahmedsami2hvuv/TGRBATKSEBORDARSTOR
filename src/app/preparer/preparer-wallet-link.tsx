import { preparerPath } from "@/lib/preparer-portal-nav";
import { GlobalIconsConfig } from "@/lib/icon-settings";
import { FullscreenWalletLauncher } from "@/components/fullscreen-wallet-launcher";

export function PreparerWalletLink({
  auth,
  icons: _icons,
}: {
  auth: { p: string; exp: string; s: string };
  icons?: GlobalIconsConfig | null;
}) {
  return (
    <FullscreenWalletLauncher
      href={preparerPath("/preparer/wallet", auth)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-400 bg-violet-50 px-3 py-2 text-center text-sm font-black text-violet-950 shadow-sm hover:bg-violet-100 sm:w-auto sm:px-4 sm:py-3"
      title="محفظة المجهز"
    >
      محفظتي
    </FullscreenWalletLauncher>
  );
}
