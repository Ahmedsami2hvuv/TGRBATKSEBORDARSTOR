async function callSeed() {
  console.log("Calling local Next.js seed endpoint...");
  try {
    const res = await fetch("http://localhost:3000/api/admin/seed-store");
    const json = await res.json();
    console.log("RESPONSE:", JSON.stringify(json, null, 2));
  } catch (err) {
    console.error("Fetch Error:", err.message);
  }
}

callSeed();
