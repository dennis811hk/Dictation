export default async function handler(req, res) {
  // 只接收 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { model = 'gemini-2.5-flash', contents, systemInstruction, generationConfig } = req.body;
    
    // 從請求 Header 獲取前端帶過來的 API Key
    const apiKey = req.headers['x-goog-api-key'] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: { message: 'Missing Gemini API Key' } });
    }

    // 由 Vercel 海外伺服器代為發送請求給 Google API (避開香港 IP 限制)
    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({ contents, systemInstruction, generationConfig })
      }
    );

    const data = await googleResponse.json();
    return res.status(googleResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: { message: err.message || 'Internal Server Error' } });
  }
}
