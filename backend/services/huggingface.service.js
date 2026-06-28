import axios from 'axios';

export async function askHuggingFace(prompt, customApiKey = null, options = {}) {
  const apiKey = customApiKey || process.env.HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return 'Mock Hugging Face response.';
  }

  const { data } = await axios.post(
    'https://router.huggingface.co/v1/chat/completions',
    {
      model: 'Qwen/Qwen2.5-7B-Instruct',
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
