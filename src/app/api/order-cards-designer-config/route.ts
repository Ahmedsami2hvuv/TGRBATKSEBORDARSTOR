import { NextResponse } from 'next/server';
import { getOrderCardsDesignerConfig } from '@/lib/order-card-customizer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await getOrderCardsDesignerConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching order cards designer config:', error);
    return NextResponse.json({ error: 'Failed to load config' }, { status: 500 });
  }
}
