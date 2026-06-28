import axios from 'axios';

function extractCohereText(data) {
  const content = data?.message?.content;

  if (Array.isArray(content)) {
    const text = content
      .filter((block) => block?.type === 'text' && block?.text)
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (text) {
      return text;
    }
  }

  if (typeof data?.message?.content === 'string' && data.message.content.trim()) {
    return data.message.content.trim();
  }

  if (typeof data?.text === 'string' && data.text.trim()) {
    return data.text.trim();
  }

  return 'Model unavailable';
}

export async function askCohere(prompt, customApiKey = null, options = {}) {
  const apiKey = customApiKey || process.env.COHERE_API_KEY;
  if (!apiKey) {
    return 'Mock Cohere response.';
  }

  const { data } = await axios.post(
    'https://api.cohere.com/v2/chat',
    {
      model: 'command-a-03-2025',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature !== undefined ? parseFloat(options.temperature) : 0.3,
      max_tokens: Math.min(parseInt(options.maxTokens || '2048', 10), 8000)
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Client-Name': 'multi-ai-response-platform'
      },
      timeout: 20000
    }
  );

  return extractCohereText(data);
}
