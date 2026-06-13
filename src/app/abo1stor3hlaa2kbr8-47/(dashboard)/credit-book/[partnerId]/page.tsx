import { getPartnerDetails } from "../actions";
import { PartnerDetailsClient } from "./partner-details-client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface PageProps {
  params: Promise<{ partnerId: string }>;
}

export const dynamic = "force-dynamic";

export default async function PartnerDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const [partner, allActivePartners] = await Promise.all([
    getPartnerDetails(resolvedParams.partnerId),
    prisma.creditBookPartner.findMany({
      where: {
        NOT: {
          type: { startsWith: "deleted_" }
        }
      },
      select: { id: true, name: true }
    })
  ]);

  if (!partner) {
    return notFound();
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8" dir="rtl">
      <div className="mb-6">
        <Link
          href="/abo1stor3hlaa2kbr8-47/credit-book"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-2xl transition"
        >
          ⬅️ العودة لدفتر الديون
        </Link>
      </div>

      <PartnerDetailsClient partner={partner} allActivePartners={allActivePartners} />
    </div>
  );
}
