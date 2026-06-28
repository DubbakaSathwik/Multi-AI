import axios from 'axios';

export async function askOpenRouter(prompt, model = 'google/gemini-2.5-flash', customApiKey = null) {
  const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const { data } = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000
    }
  );

  return data?.choices?.[0]?.message?.content || 'Model unavailable';
}
