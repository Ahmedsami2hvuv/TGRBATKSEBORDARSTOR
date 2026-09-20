import { PullToRefresh } from "@/components/pull-to-refresh";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PullToRefresh />
      {children}
    </>
  );
}
