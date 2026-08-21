
const fs = require("fs");
const path = "admin-app/app/src/main/java/com/aboakbar/admin/OrderAlertActivity.kt";
let content = fs.readFileSync(path, "utf8");

content = content.replace(`.url("$BASE_URL/couriers")`, `.url(if (isStoreOrder) "$BASE_URL/preparers" else "$BASE_URL/couriers")`);

// fix order-action url too
content = content.replace(`.url("$BASE_URL/order-action")`, `.url(if (isStoreOrder) "$BASE_URL/store-order-action" else "$BASE_URL/order-action")`);

fs.writeFileSync(path, content, "utf8");

