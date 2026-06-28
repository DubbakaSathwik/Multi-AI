import axios from 'axios';

export async function askGemini(prompt, customApiKey = null, options = {}) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelIds = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];

  for (const modelId of modelIds) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

      const { data } = await axios.post(
        url,
        {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: options.maxTokens || 8192,
            temperature: options.temperature !== undefined ? parseFloat(options.temperature) : 0.3,
            topP: options.topP !== undefined ? parseFloat(options.topP) : 0.9
          }
        },
        { timeout: 30000 }
      );

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (text) {
        return text;
      }
    } catch (error) {
      const status = error?.response?.status;
      const reason = error?.response?.data?.error?.status;
      if (status === 429 || reason === 'RESOURCE_EXHAUSTED') {
        throw error;
      }

      if (modelId === modelIds[modelIds.length - 1]) {
        throw error;
      }
    }
  }

  return 'Model unavailable';
}
