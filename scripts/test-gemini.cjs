async function listAvailableModels() {
  const key = 'AIzaSyAX9j894_6VRZK5FT7QSVaBRHkOrNQ4FNg';
  console.log(`Listing available models for key: ${key}`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    if (data.models) {
      console.log('Available Models:', data.models.map(m => m.name));
    } else {
      console.log('No models returned or error:', JSON.stringify(data));
    }
  } catch (err) {
    console.error(`Error:`, err.message);
  }
}

listAvailableModels();
