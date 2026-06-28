import { askGemini } from './gemini.service.js';
import { askOpenRouter } from './openrouter.service.js';
import { askCohere } from './cohere.service.js';
import { askGroq } from './groq.service.js';

function isUnavailableResponse(response) {
  return (
    !response ||
    response === 'Model unavailable' ||
    response === 'Mock Groq response.' ||
    response === 'Mock Cohere response.'
  );
}

function localFallbackResponse(prompt) {
  const userQuestion = String(prompt || '').match(/User question:\s*([\s\S]*)$/i)?.[1]?.trim() || '';

  if (/^(hi|hello|hey|yo|hii|hlo)[.!?\s]*$/i.test(userQuestion)) {
    return 'Hello! I am here and ready to help. What would you like to work on?';
  }

  return 'I could not reach the live AI providers right now, but I am still here. Please try again in a moment or switch to a model with an active API key.';
}

export async function askGroqWithGeminiFallback(prompt, customKeys = {}, options = {}) {
  const keys = customKeys || {};

  try {
    const response = await askGroq(prompt, keys.GROQ_API_KEY, options);
    if (isUnavailableResponse(response)) {
      throw new Error('Groq returned unavailable');
    }

    return { response, fallbackUsed: false, provider: 'Groq' };
  } catch (groqErr) {
    console.warn('Groq request failed, falling back to Gemini:', groqErr.message || groqErr);

    try {
      const response = await askGemini(prompt, keys.GEMINI_API_KEY, options);
      if (isUnavailableResponse(response)) {
        throw new Error('Gemini returned unavailable');
      }

      return { response, fallbackUsed: true, provider: 'Gemini' };
    } catch (geminiErr) {
      console.error('Gemini fallback also failed:', geminiErr.message || geminiErr);
      throw geminiErr;
    }
  }
}

export async function askGroqThenGeminiText(prompt, customKeysOrGeminiKey = {}, options = {}) {
  const keys =
    typeof customKeysOrGeminiKey === 'string'
      ? { GEMINI_API_KEY: customKeysOrGeminiKey }
      : customKeysOrGeminiKey || {};

  const result = await askGeminiWithFallback(prompt, 'google/gemini-2.5-flash', keys);
  return result.response;
}

export async function askGeminiWithFallback(prompt, fallbackModel = 'google/gemini-2.5-flash', customKeys = {}) {
  const keys = customKeys || {};
  try {
    return await askGroqWithGeminiFallback(prompt, keys);
  } catch (err) {
    console.warn('Groq and Gemini failed, falling back to OpenRouter:', err.message || err);
    try {
      const response = await askOpenRouter(prompt, fallbackModel, keys.OPENROUTER_API_KEY);
      return { response, fallbackUsed: true, provider: 'OpenRouter' };
    } catch (fallbackErr) {
      console.error('OpenRouter fallback also failed:', fallbackErr.message || fallbackErr);
      try {
        const response = await askCohere(prompt, keys.COHERE_API_KEY);
        if (!isUnavailableResponse(response)) return { response, fallbackUsed: true, provider: 'Cohere' };
      } catch (cohereErr) {
        console.error('Cohere fallback also failed:', cohereErr.message || cohereErr);
      }

      return { response: localFallbackResponse(prompt), fallbackUsed: true, provider: 'Local' };
    }
  }
}
