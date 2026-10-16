import { redirect } from "next/navigation";
import { Metadata } from "next";
import { getShopStoreMetadata } from "@/lib/store-meta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  return getShopStoreMetadata(token);
}

export default async function ShortShopRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/shop/${token}`);
}

