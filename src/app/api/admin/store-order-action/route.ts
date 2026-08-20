import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAdminToken } from "@/lib/auth";
import { notifyOneSignalPreparerAssignment } from "@/lib/onesignal-server";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    let token = authHeader?.split(" ")[1];

    if (!token) {
      const cookieHeader = request.headers.get("Cookie");
      if (cookieHeader) {
        const match = cookieHeader.split("; ").find(c => c.trim().startsWith("admin_token="));
        if (match) {
          token = match.split("=")[1];
        }
      }
    }

    if (!token || !(await verifyAdminToken(token))) {
      return NextResponse.json({ error: "??? ???? ??" }, { status: 401 });
    }

    const body = await request.json();
    const { orderNumber, action, preparerId } = body;

    if (!orderNumber || !action) {
      return NextResponse.json({ error: "?????? ?????" }, { status: 400 });
    }

    const draft = await prisma.companyPreparerShoppingDraft.findUnique({
      where: { draftNumber: Number(orderNumber) }
    });

    if (!draft) {
      return NextResponse.json({ error: "????? ??? ?????" }, { status: 404 });
    }

    if (action === "reject") {
      await prisma.companyPreparerShoppingDraft.update({
        where: { id: draft.id },
        data: { status: "cancelled" }
      });
      return NextResponse.json({ success: true, message: "?? ????? ?????" });
    } else if (action === "assign") {
      if (!preparerId) {
        return NextResponse.json({ error: "??? ?????? ????" }, { status: 400 });
      }
      
      await prisma.companyPreparerShoppingDraft.update({
        where: { id: draft.id },
        data: { 
          status: "pending",
          preparerId: preparerId
        }
      });
      
      // Notify the preparer
      void notifyOneSignalPreparerAssignment({
        preparerId,
        orderId: draft.id,
        isDraft: true
      });
      
      return NextResponse.json({ success: true, message: "?? ??????? ?????" });
    }

    return NextResponse.json({ error: "????? ??? ?????" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
