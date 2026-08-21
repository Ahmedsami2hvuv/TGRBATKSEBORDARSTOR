
const fs = require("fs");
let content = fs.readFileSync("app/build.gradle.kts", "utf8");
content = content.replace(/versionCode = (\d+)/, (match, p1) => "versionCode = " + (parseInt(p1) + 1));
fs.writeFileSync("app/build.gradle.kts", content, "utf8");

