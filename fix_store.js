
const fs = require("fs");
const path = "src/app/store/cart/page.tsx";
let content = fs.readFileSync(path, "utf8");

content = content.replace(/localStorage\.getItem\("kse_add_to_order_id"\)/g, `localStorage.getItem("kse_add_to_order_id")`); // just to locate

// Im just going to make sure the state clears properly.
// Actually, it clears in the useEffect.
// What if it is stuck? I will add a clear button on top.
// Or even better:

