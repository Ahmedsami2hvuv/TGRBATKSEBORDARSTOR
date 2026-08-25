
const fs = require("fs");
let code = fs.readFileSync("admin-app/app/src/main/res/layout/activity_order_alert.xml", "utf8");

code = code.replace(/<LinearLayout\s+android:layout_width="match_parent"\s+android:layout_height="wrap_content"\s+android:orientation="vertical"\s+android:padding="24dp"/, "<ScrollView\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"match_parent\"\n        android:fillViewport=\"true\">\n\n    <LinearLayout\n        android:layout_width=\"match_parent\"\n        android:layout_height=\"wrap_content\"\n        android:orientation=\"vertical\"\n        android:padding=\"16dp\"");

code = code.replace(/<\/LinearLayout>\s*<\/LinearLayout>/, "    </LinearLayout>\n\n    </ScrollView>\n</LinearLayout>");

code = code.replace(/android:padding="20dp"/, "android:padding=\"12dp\"");
code = code.replace(/android:layout_marginBottom="16dp"/g, "android:layout_marginBottom=\"8dp\"");
code = code.replace(/android:layout_marginBottom="24dp"/g, "android:layout_marginBottom=\"12dp\"");
code = code.replace(/android:textSize="22sp"/, "android:textSize=\"20sp\"");
code = code.replace(/android:textSize="20sp"/, "android:textSize=\"18sp\"");
code = code.replace(/android:textSize="18sp"/g, "android:textSize=\"16sp\"");
code = code.replace(/android:lineSpacingExtra="8dp"/, "android:lineSpacingExtra=\"2dp\"");
code = code.replace(/android:layout_height="150dp"/, "android:layout_height=\"120dp\"");
code = code.replace(/android:layout_height="50dp"/g, "android:layout_height=\"45dp\"");

fs.writeFileSync("admin-app/app/src/main/res/layout/activity_order_alert.xml", code);
console.log("Fixed layout");

