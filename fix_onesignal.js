
const fs = require("fs");
const path = "src/lib/onesignal-server.ts";
let content = fs.readFileSync(path, "utf8");

content = content.replace(`    web_push_priority: "high",
    android_channel_id: "hasim_floating_alert_channel",
    android_group: "hasim_alerts",
  };`, `    web_push_priority: "high",
  };`);

content = content.replace(`      notification.ios_sound = \`\${options.sound}.wav\`;
    } else {
      notification.android_sound = "hasim_alert";
    }
    notification.android_accent_color = "10b981";
    notification.small_icon = "ic_stat_onesignal_default";
    notification.android_background_layout = {
      headings_color: "FF10B981",
      contents_color: "FF334155"
    };`, `      notification.ios_sound = \`\${options.sound}.wav\`;
    }
    notification.android_accent_color = "4f46e5";
    notification.small_icon = "ic_stat_onesignal_default";

    if (options.data?.isHasimAlert) {
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
    }
`);

fs.writeFileSync(path, content, "utf8");

