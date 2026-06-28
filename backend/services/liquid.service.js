import axios from 'axios';

export async function askLiquid(prompt, customApiKey = null, options = {}) {
  const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return 'Mock Liquid LFM response.';
  }

  const { data } = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'liquid/lfm-2.5-1.2b-instruct:free',
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature !== undefined ? parseFloat(options.temperature) : 0.3,
      top_p: options.topP !== undefined ? parseFloat(options.topP) : 0.9,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 12000
    }
  );

  return data?.choices?.[0]?.message?.content || 'Model unavailable';
}
