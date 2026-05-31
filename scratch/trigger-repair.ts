import https from "https";

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

async function run() {
  const url = "https://aboakbr.com/api/fix-db-schema?secret=super-secure-fix-9923";
  console.log(`Sending request to database repair API: ${url}...`);

  try {
    const result = await getJson(url);
    console.log("--------------------------------------------------");
    console.log(`Response Status: ${result.statusCode}`);
    console.log("Response Body:", JSON.stringify(result.body, null, 2));
    console.log("--------------------------------------------------");
  } catch (err: any) {
    console.error("Request failed:", err.message || err);
  }
}

run();
