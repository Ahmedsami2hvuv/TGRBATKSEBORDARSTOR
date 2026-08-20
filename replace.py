
import sys

with open("admin-app/app/src/main/java/com/aboakbar/admin/OrderAlertActivity.kt", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("private var currentOrderNumber: Int = 0", "private var currentOrderNumber: Int = 0\n    private var isStoreOrder = false")
content = content.replace("val type = intent.getStringExtra(\"type\")", "val type = intent.getStringExtra(\"type\")\n        isStoreOrder = (type == \"store_order\")")
content = content.replace("val request = Request.Builder()\n            .url(\"$BASE_URL/couriers\")", "val fetchUrl = if (isStoreOrder) \"$BASE_URL/preparers\" else \"$BASE_URL/couriers\"\n        val request = Request.Builder()\n            .url(fetchUrl)")
content = content.replace("val array = json.getJSONArray(\"couriers\")", "val array = if (isStoreOrder) json.getJSONArray(\"preparers\") else json.getJSONArray(\"couriers\")")
content = content.replace("if (courierId != null) {\n            json.put(\"courierId\", courierId)\n        }", "if (courierId != null) {\n            if (isStoreOrder) json.put(\"preparerId\", courierId) else json.put(\"courierId\", courierId)\n        }")
content = content.replace(".url(\"$BASE_URL/order-action\")", "val actionUrl = if (isStoreOrder) \"$BASE_URL/store-order-action\" else \"$BASE_URL/order-action\"\n            .url(actionUrl)")

old_text = """            findViewById<TextView>(R.id.tvOrderDetails).text = 
                "? ?????: $orderTime\\n" +
                "?? ?????: $orderType\\n" +
                "?? ????? ???? ?????: ${formatNumber(subtotal)} ?.?\\n" +
                "?? ?????? ????? ???????: $pendingCount\""""

new_text = """            val detailsText = if (isStoreOrder) {
                "? ?????: $orderTime\\n" +
                "?? ??? ????????: $pendingCount"
            } else {
                "? ?????: $orderTime\\n" +
                "?? ?????: $orderType\\n" +
                "?? ????? ???? ?????: ${formatNumber(subtotal)} ?.?\\n" +
                "?? ?????? ????? ???????: $pendingCount"
            }
            findViewById<TextView>(R.id.tvOrderDetails).text = detailsText"""

content = content.replace(old_text, new_text)

with open("admin-app/app/src/main/java/com/aboakbar/admin/OrderAlertActivity.kt", "w", encoding="utf-8") as f:
    f.write(content)

