import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pushNotifyAdminsNewStoreOrder } from '@/lib/web-push-server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let draftId = searchParams.get('id');
  
  if (!draftId) {
    const draft = await prisma.companyPreparerShoppingDraft.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    if (!draft) return NextResponse.json({ error: 'No draft found' });
    draftId = draft.id;
  }
  
  await pushNotifyAdminsNewStoreOrder(draftId);
  return NextResponse.json({ success: true, draftId });
}
