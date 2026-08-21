
const fs = require("fs");
const path = "src/lib/onesignal-server.ts";
let content = fs.readFileSync(path, "utf8");

content = content.replace(`    if (options.data?.isHasimAlert) {
      notification.android_channel_id = "hasim_floating_alert_channel";
      notification.android_group = "hasim_alerts";
      notification.android_accent_color = "10b981";
      if (!options.sound) {
         notification.android_sound = "hasim_alert";
      }
      notification.android_background_layout = {
        headings_color: "FF10B981",
        contents_color: "FF334155"
      };
    }`, `    if (options.data?.isHasimAlert) {
      // ?? ???? android_channel_id ????? ??????? ????????? ???? ?????? ????????
      notification.android_group = "hasim_alerts";
      notification.android_accent_color = "10b981";
      if (!options.sound) {
         notification.android_sound = "hasim_alert";
      }
      notification.android_background_layout = {
        headings_color: "FF10B981",
        contents_color: "FF334155"
      };
    }`);

fs.writeFileSync(path, content, "utf8");

