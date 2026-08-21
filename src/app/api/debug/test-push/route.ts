
import { NextResponse } from 'next/server';
import { sendOneSignalNotification } from '@/lib/onesignal-server';

export async function GET() {
  const result1 = await sendOneSignalNotification({
    title: 'Test Default Sound',
    body: 'This should ring',
    url: '/',
    externalIds: ['admin_global'],
    targetApp: 'admin',
    data: { type: 'store_order' }
  });
  
  const result2 = await sendOneSignalNotification({
    title: 'Test Hasim Sound',
    body: 'This should ring with hasim',
    url: '/',
    externalIds: ['admin_global'],
    targetApp: 'admin',
    sound: 'hasim_alert',
    data: { type: 'store_order' }
  });

  return NextResponse.json({ result1, result2 });
}

