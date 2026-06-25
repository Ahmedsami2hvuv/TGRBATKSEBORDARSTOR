const ONESIGNAL_EMPLOYEE_APP_ID = "5487c703-2ecb-487c-8a99-1af4eb7f945b";
const ONESIGNAL_EMPLOYEE_REST_API_KEY = "os_v2_app_ksd4oazoznehzcuzdl2ow74ulo47l5ivtozek3fckxhta6tii3kb3rr2risxyicphxsizhnh2f6a77pley4pq7tivmuwavfz5okpcaa";

async function testOneSignal() {
  console.log("Testing OneSignal Employee Credentials using native fetch...");
  
  const notification = {
    app_id: ONESIGNAL_EMPLOYEE_APP_ID,
    contents: {
      en: "Test Strong Alert from Server Check",
      ar: "فحص التنبيه القوي من السيرفر"
    },
    headings: {
      en: "Test Alert",
      ar: "تنبيه تجريبي"
    },
    included_segments: ["Subscribed Users"]
  };

  try {
    const response = await globalThis.fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${ONESIGNAL_EMPLOYEE_REST_API_KEY.trim()}`,
      },
      body: JSON.stringify(notification),
    });

    const status = response.status;
    const data = await response.text();
    
    console.log("Response Status:", status);
    console.log("Response Body:", data);
  } catch (error) {
    console.error("Error occurred during fetch:", error);
  }
}

testOneSignal();
