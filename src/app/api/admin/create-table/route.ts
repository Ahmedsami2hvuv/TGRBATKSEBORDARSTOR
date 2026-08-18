import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("token") !== "ahmed123") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = `
      CREATE TABLE IF NOT EXISTS "JobApplication" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "region" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "carType" TEXT NOT NULL,
        "hasAc" BOOLEAN NOT NULL DEFAULT false,
        "hasCommitment" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "status" TEXT NOT NULL DEFAULT 'pending',

        CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
      );
    `;

    await prisma.$executeRawUnsafe(query);

    return NextResponse.json({ success: true, message: "Table created successfully" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
