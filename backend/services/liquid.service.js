import axios from 'axios';

export async function askLiquid(prompt, customApiKey = null, options = {}) {
  if (customApiKey) {
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
            Authorization: `Bearer ${customApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );
      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.error('Liquid LFM custom API key request failed:', err.message);
    }
  }

  // Primary execution: Local Ollama Liquid LFM model
  try {
    const { data } = await axios.post(
      'http://127.0.0.1:11434/api/chat',
      {
        model: 'hf.co/LiquidAI/LFM2.5-1.2B-Instruct-GGUF',
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: {
          num_predict: options.maxTokens || 2048,
          temperature: options.temperature !== undefined ? parseFloat(options.temperature) : 0.3,
          top_p: options.topP !== undefined ? parseFloat(options.topP) : 0.9
        }
      },
      { timeout: 60000 }
    );
    if (data?.message?.content) {
      return data.message.content;
    }
  } catch (error) {
    console.error('Local Ollama Liquid LFM query failed, falling back to OpenRouter system key:', error.message);
  }

  const systemApiKey = process.env.OPENROUTER_API_KEY;
  if (systemApiKey) {
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
            Authorization: `Bearer ${systemApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );
      if (data?.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
      }
    } catch (err) {
      console.error('OpenRouter Liquid LFM system key request failed:', err.message);
    }
  }

  return 'Model unavailable';
}
