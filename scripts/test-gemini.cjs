async function testNewModels() {
  const key = 'AIzaSyAX9j894_6VRZK5FT7QSVaBRHkOrNQ4FNg';
  console.log(`Testing new model with key: ${key}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "مرحباً يا ذكاء اصطناعي، أجب بجملة سريعة ولطيفة." }] }]
      })
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Gemini Output:', data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

testNewModels();
