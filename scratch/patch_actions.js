const fs = require('fs');
let code = fs.readFileSync('src/app/store/actions.ts', 'utf8');

code = code.replace(
  'await notifyTelegramStoreOrder(existingOrder.id);\n            const { pushNotifyAdminsNewStoreOrder } = await import("@/lib/web-push-server");\n            await pushNotifyAdminsNewStoreOrder(existingOrder.id);',
  'const { notifyTelegramStoreOrderUpdate } = await import("@/lib/telegram-notify");\n            await notifyTelegramStoreOrderUpdate(existingOrder.id, cart);\n            const { pushNotifyAdminsStoreOrderUpdated } = await import("@/lib/web-push-server");\n            await pushNotifyAdminsStoreOrderUpdated(existingOrder.id, cart.length, subtotal);'
);

fs.writeFileSync('src/app/store/actions.ts', code);
