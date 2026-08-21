const fs = require('fs');
const path = 'src/app/store/cart/page.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/setCart\(\[\]\);/g, 'setCart([]);\n        setAddToOrderId(null);\n        hasRedirectedToWhatsappRef.current = false;\n');
fs.writeFileSync(path, content, 'utf8');
