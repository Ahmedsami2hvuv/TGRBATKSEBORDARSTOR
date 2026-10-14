import { redirect } from "next/navigation";

export default async function ShortShopRedirect({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/store/shop/${token}`);
}
