import axios from 'axios';
import { askGroq } from './groq.service.js';

export async function askLiquid(prompt, customApiKey = null, options = {}) {
  const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;

  if (apiKey) {
    try {
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

      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (error) {
      console.error('Liquid LFM service error, falling back to Groq:', error.message);
    }
  }

  try {
    const fallbackText = await askGroq(prompt, null, options);
    if (fallbackText && fallbackText !== 'Model unavailable') {
      return `${fallbackText}\n\n*(Note: Liquid LFM upstream provider is temporarily offline; response generated via Groq Llama fallback)*`;
    }
  } catch (fallbackError) {
    console.error('Liquid LFM fallback to Groq failed:', fallbackError.message);
  }

  return 'Hello! Mock Liquid LFM response (Upstream provider temporarily offline).';
}
