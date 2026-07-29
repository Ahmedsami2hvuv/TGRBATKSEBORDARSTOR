const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\lenovo\\.gemini\\antigravity\\brain\\64f9276f-d644-4b78-afc0-7e7809ee2206';
const targetDir = 'C:\\Users\\lenovo\\Documents\\GitHub\\TGRBATKSEBORDARSTOR\\public\\products';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(brainDir);

const mappings = [
  { prefix: 'lahm_small_normal_', name: 'lahm_small_normal.jpg' },
  { prefix: 'lahm_small_cheese_', name: 'lahm_small_cheese.jpg' },
  { prefix: 'lahm_small_egg_', name: 'lahm_small_egg.jpg' },
  { prefix: 'lahm_small_zaatar_', name: 'lahm_small_zaatar.jpg' },
  { prefix: 'lahm_large_normal_', name: 'lahm_large_normal.jpg' },
  { prefix: 'french_fries_', name: 'french_fries.jpg' },
  { prefix: 'crispy_3pcs_', name: 'crispy_3pcs.jpg' },
  { prefix: 'crispy_5pcs_', name: 'crispy_5pcs.jpg' },
  { prefix: 'pizza_beef_', name: 'pizza_beef.jpg' },
  { prefix: 'pizza_chicken_', name: 'pizza_chicken.jpg' },
  { prefix: 'pizza_veggie_', name: 'pizza_veggie.jpg' },
  { prefix: 'pizza_mixed_', name: 'pizza_mixed.jpg' },
  { prefix: 'rizo_spicy_', name: 'rizo_spicy.jpg' },
  { prefix: 'rizo_normal_', name: 'rizo_normal.jpg' },
  { prefix: 'pepsi_can_', name: 'pepsi_can.jpg' },
  { prefix: 'shani_can_', name: 'shani_can.jpg' },
  { prefix: 'seven_up_can_', name: 'seven_up_can.jpg' },
];

for (const m of mappings) {
  const found = files.find(f => f.startsWith(m.prefix) && f.endsWith('.jpg'));
  if (found) {
    const srcPath = path.join(brainDir, found);
    const destPath = path.join(targetDir, m.name);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Copied ${found} -> ${m.name}`);
  } else {
    console.log(`Warning: could not find file for prefix ${m.prefix}`);
  }
}
