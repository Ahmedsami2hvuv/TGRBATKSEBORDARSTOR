import { prisma } from "@/lib/prisma";
import SmartHintsListClient from "./smart-hints-list-client";

export const dynamic = "force-dynamic";

export default async function SmartHintsListPage() {
  const allWaypoints = await prisma.regionWaypoint.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      region: {
        select: {
          name: true,
        },
      },
    },
  });

  return <SmartHintsListClient allWaypoints={allWaypoints} />;
}
