import { prisma } from "@/lib/prisma";
import { AssistantClient } from "./assistant-client";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function PreparerAssistantPage({ searchParams }: Props) {
  const sp = await searchParams;
  const preparerId = typeof sp.preparerId === "string" ? sp.preparerId.trim() : "";

  let preparer = null;
  if (preparerId) {
    preparer = await prisma.companyPreparer.findUnique({
      where: { id: preparerId },
      select: { id: true, name: true, active: true },
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-2 sm:p-4">
      <AssistantClient initialPreparer={preparer} initialPreparerId={preparerId} />
    </main>
  );
}
