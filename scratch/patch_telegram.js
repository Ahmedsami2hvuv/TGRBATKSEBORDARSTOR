const fs = require('fs');
let code = fs.readFileSync('src/lib/telegram-notify.ts', 'utf8');

const newFunc = [
  'export async function notifyTelegramStoreOrderUpdate(orderId: string, cart: any[]): Promise<void> {',
  '    const order = await prisma.order.findUnique({',
  '      where: { id: orderId },',
  '      include: { customerRegion: true }',
  '    });',
  '    if (!order) return;',
  '',
  '    const text = [',
  '      \u200F🛍 <b>إضافة جديدة لطلب من المتجر</b>,',
  '      \u200F🔖 <b>رقم الطلب الأصلي:</b> \u200E\\u200E,',
  '      \u200F👤 <b>الزبون:</b> \,',
  '      \u200F-------------------------,',
  '      \u200F<b>المنتجات المضافة حديثاً:</b>,',
  '      ...cart.map(i => \u200F▫️ \ (\)),',
  '      \u200F-------------------------,',
  '      \u200F🔗 <a href="\/abo1stor3hlaa2kbr8-47/orders/pending?tab=preparing">فتح لوحة الطلبات</a>',
  '    ].join("\\n");',
  '',
  '    const notificationBotToken = await getBotTokenByPurpose("notification");',
  '    if (notificationBotToken) {',
  '      await sendTelegramMessage(text, { botToken: notificationBotToken }).catch(() => null);',
  '    }',
  '}',
].join('\n');

code = code.replace('export async function notifyTelegramStoreOrder', newFunc + '\nexport async function notifyTelegramStoreOrder');
fs.writeFileSync('src/lib/telegram-notify.ts', code);
