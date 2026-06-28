import { prisma } from "@/lib/prisma";
import EditSmartHintClient from "./edit-client";
import { notFound } from "next/navigation";

export default async function EditPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const waypoint = await prisma.regionWaypoint.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      polygonCoords: true,
    },
  });

  if (!waypoint) {
    notFound();
  }

  return <EditSmartHintClient waypoint={waypoint} />;
}
