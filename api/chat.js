// 延長 Vercel Serverless Function 逾時上限至 60 秒（避免 3.8 Flash 思考超時報 504）
export const maxDuration = 60;

export default async function handler(req, res) {
  // 只接收 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const startMs = Date.now();

  try {
    const {
      model = 'gemini-3.5-flash-lite',
      contents,
      systemInstruction,
      generationConfig
    } = req.body || {};

    // 從請求 Header 或環境變數獲取 API Key
    const apiKey = req.headers['x-goog-api-key'] || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ error: { message: 'Missing Gemini API Key' } });
    }

    // 自動清洗 Gemini 3.5+ / 3.8 / 4 不再支援嘅舊參數，避免觸發 400 錯誤
    let sanitizedConfig = generationConfig ? { ...generationConfig } : undefined;
    const isModernGemini = /^gemini-(3\.[5-9]|4)/i.test(model);

    if (sanitizedConfig && isModernGemini) {
      delete sanitizedConfig.temperature;
      delete sanitizedConfig.topP;
      delete sanitizedConfig.topK;
      delete sanitizedConfig.top_p;
      delete sanitizedConfig.top_k;
      delete sanitizedConfig.frequencyPenalty;
      delete sanitizedConfig.presencePenalty;

      // Gemini 3.8 / 4 不支援 MINIMAL，若誤傳則自動修正為 LOW
      if (
        /^gemini-(3\.8|4)/i.test(model) &&
        sanitizedConfig.thinkingConfig &&
        String(sanitizedConfig.thinkingConfig.thinkingLevel).toUpperCase() === 'MINIMAL'
      ) {
        sanitizedConfig.thinkingConfig = {
          ...sanitizedConfig.thinkingConfig,
          thinkingLevel: 'LOW'
        };
      }
    }

    const payload = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (sanitizedConfig && Object.keys(sanitizedConfig).length > 0) {
      payload.generationConfig = sanitizedConfig;
    }

    // 由 Vercel 海外伺服器代為發送請求給 Google API (避開香港 IP 限制)
    const googleResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const rawText = await googleResponse.text();
    const latencyMs = Date.now() - startMs;
    res.setHeader('X-AI-Latency-Ms', String(latencyMs));

    // 安全解析 JSON（防止 Google 回傳 HTML 閘道錯誤導致後端崩潰）
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return res.status(googleResponse.status || 502).json({
        error: {
          message: `Upstream returned non-JSON response (HTTP ${googleResponse.status})`
        }
      });
    }

    return res.status(googleResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: { message: err.message || 'Internal Server Error' }
    });
  }
}
