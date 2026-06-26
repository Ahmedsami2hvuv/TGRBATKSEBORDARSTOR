const ONESIGNAL_EMPLOYEE_APP_ID = "5487c703-2ecb-487c-8a99-1af4eb7f945b";
const ONESIGNAL_EMPLOYEE_REST_API_KEY = "os_v2_app_ksd4oazoznehzcuzdl2ow74ulo47l5ivtozek3fckxhta6tii3kb3rr2risxyicphxsizhnh2f6a77pley4pq7tivmuwavfz5okpcaa";

async function test() {
  console.log("Testing OneSignal direct API request to employee...");
  const userIds = ["cmq6dx45h0000jo04y8nke98e"]; // حسناء
  
  const notification = {
    app_id: ONESIGNAL_EMPLOYEE_APP_ID,
    target_channel: "push",
    url: "",
    data: {
      type: "strong_alert",
      action: "start",
      alertId: "test_sched_" + Date.now(),
      customTitle: "تنبيه موظف مجدول تجريبي",
      customBody: "هل تسمعني؟",
      showWhatsapp: "false",
      showOpenApp: "true",
      showDismiss: "true",
      theme: "red"
    },
    android_visibility: 1,
    priority: 10,
    huawei_priority: 10,
    web_push_priority: "high",
    content_available: true // صامت لكي يوقظ الخلفية
  };

  notification.include_aliases = {
    external_id: userIds,
  };
  notification.include_external_user_ids = userIds;

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_EMPLOYEE_REST_API_KEY.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const isOk = response.ok;
    const responseData = isOk ? await response.json() : await response.text();
    console.log("Status:", response.status);
    console.log("Response Data:", responseData);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
