import { getPartnerDetails } from "@/app/abo1stor3hlaa2kbr8-47/(dashboard)/credit-book/actions";
import { ShareDetailsClient } from "./share-details-client";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ partnerId: string }>;
}

export const dynamic = "force-dynamic";

export default async function SharePartnerPage({ params }: PageProps) {
  const resolvedParams = await params;
  const partner = await getPartnerDetails(resolvedParams.partnerId);

  if (!partner) {
    return notFound();
  }

  // We pass partner to a read-only client component
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8" dir="rtl">
      <ShareDetailsClient partner={partner} />
    </div>
  );
}
