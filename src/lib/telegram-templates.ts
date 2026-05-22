export function getDefaultTelegramNewOrderTemplate(): string {
  return [
    "🏪 ({shopName} — {customerName}){vehicleEmoji}",
    "📍 {regionName}",
    "📦 {orderType}",
    "💵 {subtotal}",
    "🚚 {delivery}",
    "💰 {total}",
    "⏰ {noteTime}",
    "🔢 {orderNumber}",
    "📞 {customerPhone}",
  ].join("\n");
}
