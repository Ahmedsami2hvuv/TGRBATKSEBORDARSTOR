import { getPartnerDetails } from "../actions";
import { PartnerDetailsClient } from "./partner-details-client";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ partnerId: string }>;
}

export const dynamic = "force-dynamic";

export default async function PartnerDetailsPage({ params }: PageProps) {
  const resolvedParams = await params;
  const partner = await getPartnerDetails(resolvedParams.partnerId);

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

      <PartnerDetailsClient partner={partner} />
    </div>
  );
}
