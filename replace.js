
const fs = require("fs");
let content = fs.readFileSync("admin-app/app/src/main/java/com/aboakbar/admin/OrderAlertActivity.kt", "utf8");

content = content.replace("private var currentOrderNumber: Int = 0", "private var currentOrderNumber: Int = 0\n    private var isStoreOrder = false");
content = content.replace("val type = intent.getStringExtra(\"type\") ?: \"new_order\"", "val type = intent.getStringExtra(\"type\") ?: \"new_order\"\n        isStoreOrder = (type == \"store_order\")");
content = content.replace("val request = Request.Builder()\n            .url(\"`$BASE_URL/couriers\")", "val fetchUrl = if (isStoreOrder) \"`$BASE_URL/preparers\" else \"`$BASE_URL/couriers\"\n        val request = Request.Builder()\n            .url(fetchUrl)");
content = content.replace("val array = json.getJSONArray(\"couriers\")", "val array = if (isStoreOrder) json.getJSONArray(\"preparers\") else json.getJSONArray(\"couriers\")");
content = content.replace("if (courierId != null) {\n            json.put(\"courierId\", courierId)\n        }", "if (courierId != null) {\n            if (isStoreOrder) json.put(\"preparerId\", courierId) else json.put(\"courierId\", courierId)\n        }");
content = content.replace(".url(\"`$BASE_URL/order-action\")", "val actionUrl = if (isStoreOrder) \"`$BASE_URL/store-order-action\" else \"`$BASE_URL/order-action\"\n            .url(actionUrl)");

let lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("findViewById<TextView>(R.id.tvOrderDetails).text =")) {
        if (lines[i+1].includes("?????")) { // The second one
            lines[i] = `            val detailsText = if (isStoreOrder) {
                "? ?????: ${"`$orderTime"}\\n" +
                "?? ??? ????????: ${"`$pendingCount"}"
            } else {
                "? ?????: ${"`$orderTime"}\\n" +
                "?? ?????: ${"`$orderType"}\\n" +
                "?? ????? ???? ?????: ${"`${formatNumber(subtotal)}" } ?.?\\n" +
                "?? ?????? ????? ???????: ${"`$pendingCount"}"
            }
            findViewById<TextView>(R.id.tvOrderDetails).text = detailsText`;
            // clear the next 4 lines
            lines[i+1] = "";
            lines[i+2] = "";
            lines[i+3] = "";
            lines[i+4] = "";
            break;
        }
    }
}
fs.writeFileSync("admin-app/app/src/main/java/com/aboakbar/admin/OrderAlertActivity.kt", lines.join("\n"), "utf8");

