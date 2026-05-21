import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ADMIN_TILES, tileHref } from "@/lib/admin-nav";
import { ad } from "@/lib/admin-ui";

type Props = { params: Promise<{ slug: string }> };

const SLUGS = new Set(ADMIN_TILES.map((t) => t.slug));

const SECRET_ADMIN_PATH = "/abo1stor3hlaa2kbr8-47";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tile = ADMIN_TILES.find((t) => t.slug === slug);
  return {
    title: tile ? `${tile.label} — أبو الأكبر للتوصيل` : "قسم — أبو الأكبر للتوصيل",
  };
}

export default async function ModulePlaceholderPage({ params }: Props) {
  const { slug } = await params;

  if (slug === "regions") {
    redirect(`${SECRET_ADMIN_PATH}/regions`);
  }
  if (slug === "shops") {
    redirect(`${SECRET_ADMIN_PATH}/shops`);
  }
  if (slug === "new-orders") {
    redirect(`${SECRET_ADMIN_PATH}/orders/pending`);
  }
  if (slug === "couriers") {
    redirect(`${SECRET_ADMIN_PATH}/couriers`);
  }
  if (slug === "customers") {
    redirect(`${SECRET_ADMIN_PATH}/customers`);
  }
  if (slug === "order-tracking") {
    redirect(`${SECRET_ADMIN_PATH}/orders/tracking`);
  }
  if (slug === "reports") {
    redirect(`${SECRET_ADMIN_PATH}/reports`);
  }
  if (slug === "preparers") {
    redirect(`${SECRET_ADMIN_PATH}/preparers`);
  }
  if (slug === "employees") {
    redirect(`${SECRET_ADMIN_PATH}/employees`);
  }

  if (!SLUGS.has(slug)) {
    notFound();
  }

  const tile = ADMIN_TILES.find((t) => t.slug === slug)!;

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href={SECRET_ADMIN_PATH} className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div
        className={`${ad.section} border-dashed border-amber-200 text-center ring-amber-100`}
      >
        <div className="text-4xl">{tile.emoji}</div>
        <h1 className={`mt-3 ${ad.h1}`}>{tile.label}</h1>
        <p className={`mt-2 ${ad.lead}`}>
          هذا القسم قيد التطوير وسيُربط بالجداول والمنطق لاحقاً.
        </p>
      </div>
    </div>
  );
}
