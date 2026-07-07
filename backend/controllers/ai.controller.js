import { askGemini } from '../services/gemini.service.js';
import { askLiquid } from '../services/liquid.service.js';
import { askHuggingFace } from '../services/huggingface.service.js';
import { askGroq } from '../services/groq.service.js';
import { askCohere } from '../services/cohere.service.js';
import { askGeminiWithFallback, askGroqThenGeminiText } from '../services/auxiliary.service.js';
import ApiUsage from '../models/apiUsage.model.js';
import { getOptionalUserId } from '../utils/auth.js';

async function askWithResilientFallbacks(modelName, primaryAskFn, prompt, customApiKey, options = {}) {
  try {
    const text = await primaryAskFn(prompt, customApiKey, options);
    if (isUsableResponseText(text)) {
      return text;
    }
    throw new Error('Unusable response text');
  } catch (primaryError) {
    console.warn(`Primary model ${modelName} failed, initiating fallback logic:`, primaryError.message);
    
    // Wait 1.5 seconds (1500 ms) before performing the smart fallback route
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const cleanPrompt = String(prompt || '').trim();
    const emulationPrompt = `You are a large language model emulating the ${modelName} model. Respond to the user's prompt exactly as ${modelName} would. User prompt: ${cleanPrompt}`;
    
    // Smart Fallback Route v1: Groq Llama (Skip if primary is Groq to avoid double failures)
    const isGroq = modelName.toLowerCase().includes('groq');
    let v1Success = false;
    let fallbackText = '';

    if (!isGroq) {
      try {
        console.log(`Smart Fallback Route v1 (Groq Llama) starting for model: ${modelName}`);
        const v1Response = await askGroq(emulationPrompt, null, options);
        if (isUsableResponseText(v1Response)) {
          fallbackText = `${v1Response}\n\n*(Note: ${modelName} is temporarily offline; response generated via Smart Fallback Route v1 [Groq Llama])*`;
          v1Success = true;
        }
      } catch (v1Error) {
        console.error(`Smart Fallback Route v1 (Groq Llama) failed for ${modelName}:`, v1Error.message);
      }
    }

    if (v1Success) {
      return fallbackText;
    }

    // Smart Fallback Route v2: Gemini Flash (Skip if primary is Gemini to avoid double failures)
    const isGemini = modelName.toLowerCase().includes('gemini');
    if (!isGemini) {
      try {
        console.log(`Smart Fallback Route v2 (Gemini Flash) starting for model: ${modelName}`);
        const v2Response = await askGemini(emulationPrompt, null, options);
        if (isUsableResponseText(v2Response)) {
          return `${v2Response}\n\n*(Note: ${modelName} is temporarily offline; response generated via Smart Fallback Route v2 [Gemini Flash])*`;
        }
      } catch (v2Error) {
        console.error(`Smart Fallback Route v2 (Gemini Flash) failed for ${modelName}:`, v2Error.message);
      }
    }

    // If both fallbacks failed (or were skipped), re-throw original error
    throw primaryError;
  }
}

const modelRequests = [
  {
    model: 'Gemini Flash',
    aliases: ['Gemini Flash', 'Gemini', 'GeminiFlash'],
    ask: (prompt, key, opt) => askWithResilientFallbacks('Gemini Flash', askGroqThenGeminiText, prompt, key, opt)
  },
  {
    model: 'Liquid LFM',
    aliases: ['Liquid LFM', 'Liquid'],
    ask: (prompt, key, opt) => askWithResilientFallbacks('Liquid LFM', askLiquid, prompt, key, opt)
  },
  {
    model: 'Qwen HF',
    aliases: ['Qwen HF', 'Hugging Face', 'HuggingFace'],
    ask: (prompt, key, opt) => askWithResilientFallbacks('Qwen HF', askHuggingFace, prompt, key, opt)
  },
  {
    model: 'Groq',
    aliases: ['Groq', 'Groq Llama'],
    ask: (prompt, key, opt) => askWithResilientFallbacks('Groq', askGroq, prompt, key, opt)
  },
  {
    model: 'Cohere',
    aliases: ['Cohere', 'Cohere Command'],
    ask: (prompt, key, opt) => askWithResilientFallbacks('Cohere', askCohere, prompt, key, opt)
  }
];

function getFailureMessage(error) {
  const status = error?.response?.status;
  const providerMessage = error?.response?.data?.error?.message || error?.response?.data?.error;
  const requestUrl = String(error?.config?.url || '').toLowerCase();
  const isHuggingFaceRequest = requestUrl.includes('huggingface.co');

  if (status === 402) {
    return 'OpenRouter credits required';
  }

  if (status === 403 && isHuggingFaceRequest) {
    return 'Hugging Face key needs Inference Providers permission.';
  }

  if (status === 429) {
    return 'Provider rate-limited. Try again shortly.';
  }

  if (error?.code === 'ECONNABORTED') {
    return 'Provider timed out. Try again shortly.';
  }

  if (typeof providerMessage === 'string' && providerMessage.trim()) {
    return providerMessage;
  }

  return 'Model unavailable';
}

function buildPrompt(userPrompt) {
  const today = new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeZone: 'Asia/Kolkata'
  }).format(new Date());

  return [
    `Current date: ${today}.`,
    'Answer the user directly and concisely. Do not mention lack of real-time access for date questions because the current date is provided above.',
    `User question: ${userPrompt}`
  ].join('\n');
}

function isUsableResponseText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return false;

  return ![
    'model unavailable',
    'provider rate-limited',
    'rate-limited',
    'timed out',
    'try again shortly',
    'credits required',
    'currently experiencing high demand',
    'both groq and gemini fallback failed',
    'service currently unavailable',
    'unable to respond',
    'connection issue'
  ].some((phrase) => normalized.includes(phrase));
}

function fallbackBestResponse(candidates) {
  const usable = candidates.filter((item) => isUsableResponseText(item.response));
  if (usable.length === 0) return null;

  return usable
    .map((item) => {
      const words = String(item.response || '').trim().split(/\s+/).filter(Boolean).length;
      const hasStructure = /(^|\n)\s*(#|- |\d+\. )/.test(item.response || '');
      const directness = words >= 8 ? 30 : 0;
      const lengthScore = words >= 30 && words <= 450 ? 30 : words > 450 ? 18 : 10;
      const structureScore = hasStructure ? 8 : 0;
      return { ...item, score: directness + lengthScore + structureScore };
    })
    .sort((a, b) => b.score - a.score)[0];
}

export async function chatWithModels(request, response) {
  const { prompt, models, customKeys, temperature, maxTokens, topP, modelParameters, clientId } = request.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Prompt is required'
    });
  }

  const requestedModels =
    Array.isArray(models) && models.length > 0
      ? models.filter((model) => typeof model === 'string' && model.trim())
      : modelRequests.map(({ model }) => model);

  const activeModelRequests = requestedModels.map((requestedModel) => {
    const service = modelRequests.find(({ aliases }) => aliases.includes(requestedModel));

    return {
      model: requestedModel,
      canonicalModel: service?.model || requestedModel,
      ask: service?.ask
    };
  });

  const settledResponses = await Promise.allSettled(
    activeModelRequests.map(async ({ model, canonicalModel, ask }) => {
      const startedAt = Date.now();
      if (!ask) {
        return {
          model,
          response: 'Model unavailable',
          status: 'failed',
          latencyMs: Date.now() - startedAt
        };
      }

      // Map model to custom API key if BYOK is active
      let customKey = null;
      if (customKeys) {
        if (canonicalModel === 'Gemini Flash') customKey = customKeys.GEMINI_API_KEY;
        else if (canonicalModel === 'Liquid LFM') customKey = customKeys.OPENROUTER_API_KEY;
        else if (canonicalModel === 'Qwen HF') customKey = customKeys.HUGGINGFACE_API_KEY;
        else if (canonicalModel === 'Groq') customKey = customKeys.GROQ_API_KEY;
        else if (canonicalModel === 'Cohere') customKey = customKeys.COHERE_API_KEY;
      }

      const modelOptions = {
        temperature,
        maxTokens,
        topP,
        ...(modelParameters?.[canonicalModel] || modelParameters?.[model] || {})
      };
      let text = '';
      let status = 'success';

      try {
        text = await ask(buildPrompt(prompt.trim()), customKey, modelOptions);
        if (!isUsableResponseText(text)) status = 'failed';
      } catch (error) {
        status = 'failed';
        throw error;
      } finally {
        if (clientId) {
          ApiUsage.create({
            clientId,
            userId: getOptionalUserId(request),
            model,
            latencyMs: Date.now() - startedAt,
            status,
            feature: 'chat'
          }).catch((usageError) => console.warn('Usage telemetry save failed:', usageError.message));
        }
      }

      return {
        model,
        response: text,
        status,
        latencyMs: Date.now() - startedAt
      };
    })
  );

  const responses = settledResponses.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    return {
      model: activeModelRequests[index].model,
      response: getFailureMessage(result.reason),
      status: 'failed'
    };
  });

  return response.json({
    success: true,
    prompt: prompt.trim(),
    responses
  });
}

export async function diagnoseGemini(request, response) {
  if (!process.env.GEMINI_API_KEY) {
    return response.json({
      success: false,
      provider: 'Gemini',
      status: 'missing_key',
      message: 'GEMINI_API_KEY is not set in backend/.env'
    });
  }

  try {
    const text = await askGemini('Reply with OK only.', null, { maxTokens: 16, temperature: 0.1 });
    return response.json({
      success: true,
      provider: 'Gemini',
      status: 'ok',
      sample: text
    });
  } catch (error) {
    const httpStatus = error?.response?.status || null;
    const reason = error?.response?.data?.error?.status || null;
    const providerMessage = error?.response?.data?.error?.message || error?.message || 'Gemini request failed';
    const status =
      httpStatus === 429 || reason === 'RESOURCE_EXHAUSTED'
        ? 'quota_or_rate_limited'
        : httpStatus === 400
          ? 'bad_request_or_invalid_key'
          : 'error';

    return response.json({
      success: false,
      provider: 'Gemini',
      status,
      httpStatus,
      reason,
      message: providerMessage
    });
  }
}

export async function generateConsensus(request, response) {
  const { responses, customKeys } = request.body;

  if (!Array.isArray(responses) || responses.length === 0) {
    return response.status(400).json({
      success: false,
      message: 'Model responses are required for consensus synthesis'
    });
  }

  const systemPrompt = `You are a high-performance AI Consensus Engine.
Given the following AI response outputs to a query, synthesize them into a single final unified response.
Provide your output in Markdown, structured exactly as follows:
# Final Unified Answer
[Insert the best synthesized answer here, resolving contradictions and compiling facts]

# Important Points
- [Key point 1]
- [Key point 2]

# Final Recommendation
[Insert actionable conclusion or recommendation here]

Responses to synthesize:
${JSON.stringify(responses, null, 2)}`;

  try {
    const result = await askGeminiWithFallback(systemPrompt, 'google/gemini-2.5-flash', customKeys);
    return response.json({
      success: true,
      consensus: result.response,
      fallbackUsed: result.fallbackUsed
    });
  } catch (err) {
    console.error('Consensus generation failed:', err);
    return response.status(500).json({
      success: false,
      message: 'Failed to generate consensus output.'
    });
  }
}

function parseBestResponseJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeOptimizerField(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object') {
    const nested =
      value.prompt ||
      value.text ||
      value.output ||
      value.content ||
      value.value ||
      value.description;

    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }

    const firstString = Object.values(value).find((item) => typeof item === 'string' && item.trim());
    if (firstString) {
      return firstString.trim();
    }
  }

  return fallback;
}

export async function chooseBestResponse(request, response) {
  const { prompt, responses, customKeys } = request.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Prompt is required for best response selection'
    });
  }

  if (!Array.isArray(responses) || responses.length === 0) {
    return response.status(400).json({
      success: false,
      message: 'Model responses are required for best response selection'
    });
  }

  const usableResponses = responses.filter((item) => isUsableResponseText(item?.response));

  if (usableResponses.length === 0) {
    return response.status(422).json({
      success: false,
      message: 'No usable responses are available for judging.'
    });
  }

  const systemPrompt = `You are an impartial AI response judge.
Select the single best answer to the user's question from the candidate model responses.

Rules:
- Do not select responses that say the model is unavailable, rate-limited, timed out, overloaded, still processing, or unable to answer.
- You must choose from the supplied usable candidates only.
- Judge only factual correctness, directness, completeness, clarity, and usefulness for the user's question.
- If multiple answers are close, choose the one that most directly answers the question.
- Return ONLY strict JSON. No markdown. No explanation outside JSON.

JSON schema:
{
  "bestModel": "exact model name from candidates",
  "reason": "brief reason",
  "bestResponse": "the selected response text"
}

User question:
${prompt.trim()}

Candidate responses:
${JSON.stringify(usableResponses, null, 2)}`;

  try {
    const result = await askGeminiWithFallback(systemPrompt, 'google/gemini-2.5-flash', customKeys);
    const parsed = parseBestResponseJson(result.response);

    if (!parsed?.bestModel) {
      const fallback = fallbackBestResponse(usableResponses);
      if (!fallback) {
        return response.status(502).json({
          success: false,
          message: 'Best response judge returned an unreadable result'
        });
      }

      return response.json({
        success: true,
        bestModel: fallback.model,
        bestResponse: fallback.response,
        reason: 'Selected by local fallback because the judge returned an unreadable result.',
        fallbackUsed: true
      });
    }

    const chosen = usableResponses.find((item) => item.model === parsed.bestModel);

    if (!chosen || !isUsableResponseText(chosen.response)) {
      const fallback = fallbackBestResponse(usableResponses);
      return response.json({
        success: true,
        bestModel: fallback.model,
        bestResponse: fallback.response,
        reason: 'Judge selected an unusable response, so MultiAI selected the strongest valid response instead.',
        fallbackUsed: true
      });
    }

    return response.json({
      success: true,
      bestModel: chosen.model,
      bestResponse: parsed.bestResponse || chosen?.response || '',
      reason: parsed.reason || 'Selected by Groq-first judge.',
      fallbackUsed: result.fallbackUsed
    });
  } catch (err) {
    console.error('Best response selection failed:', err);
    const fallback = fallbackBestResponse(usableResponses);
    if (!fallback) {
      return response.status(500).json({
        success: false,
        message: 'Failed to select best response.'
      });
    }

    return response.json({
      success: true,
      bestModel: fallback.model,
      bestResponse: fallback.response,
      reason: 'Selected locally because the judge service failed.',
      fallbackUsed: true
    });
  }
}

export async function optimizePrompt(request, response) {
  const { prompt, customKeys } = request.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Prompt is required for optimization'
    });
  }

  const systemPrompt = `You are an AI Prompt Optimizer.
Optimize the following user prompt into three distinct versions:
1. Beginner (simple, clear explanation request)
2. Expert (detailed with applications, advantages, limitations, and future scope)
3. Research (academic, technical formulation)

Output MUST be a strict, valid JSON object with EXACTLY three keys: "beginner", "expert", and "research".
Do not wrap it in markdown block. Return ONLY the raw JSON object.
User prompt: "${prompt}"`;

  try {
    const result = await askGeminiWithFallback(systemPrompt, 'google/gemini-2.5-flash', customKeys);
    let cleaned = result.response.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    }

    try {
      const parsed = JSON.parse(cleaned);
      return response.json({
        success: true,
        beginner: normalizeOptimizerField(parsed.beginner, `Explain in simple terms: ${prompt}`),
        expert: normalizeOptimizerField(parsed.expert, `Provide a detailed explanation of ${prompt} with applications, advantages, and limitations.`),
        research: normalizeOptimizerField(parsed.research, `Analyze ${prompt} from a technical and academic research perspective.`),
        fallbackUsed: result.fallbackUsed
      });
    } catch (parseErr) {
      console.warn('JSON parsing of optimized prompt failed, falling back to manual splits:', parseErr);
      return response.json({
        success: true,
        beginner: `Explain in simple terms: ${prompt}`,
        expert: `Provide a detailed explanation of ${prompt} with applications, advantages, and limitations.`,
        research: `Analyze ${prompt} from a technical and academic research perspective.`,
        fallbackUsed: result.fallbackUsed,
        raw: result.response
      });
    }
  } catch (err) {
    console.error('Prompt optimization failed:', err);
    return response.status(500).json({
      success: false,
      message: 'Failed to optimize prompt.'
    });
  }
}

export async function createPersonaDraft(request, response) {
  const { idea, customKeys } = request.body;

  if (!idea || typeof idea !== 'string' || !idea.trim()) {
    return response.status(400).json({
      success: false,
      message: 'Persona idea is required'
    });
  }

  const systemPrompt = `Create a custom AI assistant persona for a multi-model prompt comparison app.
The user describes the assistant they need. Generate concise, practical persona details.

Return ONLY strict JSON:
{
  "name": "short persona name",
  "desc": "one sentence summary",
  "systemPrompt": "clear system instructions for how this assistant should behave"
}

User idea: ${idea.trim()}`;

  const fallbackPersona = {
    name: idea.trim().split(/\s+/).slice(0, 3).join(' ').replace(/[^\w\s-]/g, '') || 'Custom Assistant',
    desc: `Assistant focused on ${idea.trim()}.`,
    systemPrompt: `Act as an expert assistant focused on ${idea.trim()}. Answer clearly, stay practical, ask for missing context when needed, and adapt the response to the user's level.`
  };

  try {
    const result = await Promise.race([
      askGeminiWithFallback(systemPrompt, 'google/gemini-2.5-flash', customKeys),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Persona generation timed out')), 9000))
    ]);
    const parsed = parseBestResponseJson(result.response);

    if (parsed?.name && parsed?.desc && parsed?.systemPrompt) {
      return response.json({
        success: true,
        persona: parsed,
        fallbackUsed: result.fallbackUsed
      });
    }
  } catch (err) {
    console.error('Persona draft generation failed:', err);
  }

  return response.json({
    success: true,
    persona: fallbackPersona,
    fallbackUsed: true
  });
}

export async function debateStep(request, response) {
  const { topic, modelName, turn, currentRound, transcript, customKeys, lengthOption } = request.body;

  if (!topic || !modelName || !turn) {
    return response.status(400).json({
      success: false,
      message: 'Topic, modelName, and turn are required for debate rounds'
    });
  }

  let lengthInstruction = 'under 150 words';
  if (lengthOption === 'short') {
    lengthInstruction = 'strictly between 30 to 40 words';
  } else if (lengthOption === 'medium') {
    lengthInstruction = 'strictly between 50 to 70 words';
  } else if (lengthOption === 'long') {
    lengthInstruction = 'strictly between 100 to 120 words';
  }

  const side = turn === 'A' ? 'POSITIVE' : 'NEGATIVE';
  let contextPrompt = `You are participating in a structured debate on the topic: "${topic}".
You represent the ${side} side (supporting the topic if POSITIVE, opposing it if NEGATIVE).
Your goal is to persuade the judges by providing compelling arguments and rebutting the opponent's claims.
Keep your response concise, sharp, and ${lengthInstruction}. Do not prepend markdown header blocks.`;

  if (!transcript || transcript.length === 0) {
    contextPrompt += `\nThis is the opening round. Please present your opening argument.`;
  } else {
    contextPrompt += `\nHere is the debate transcript so far:\n${transcript
      .map((t) => `[${t.model} (${t.role.toUpperCase()})]: ${t.text}`)
      .join('\n\n')}\n\nPlease provide your rebuttal to the opponent's points and advance your argument.`;
  }

  const service = modelRequests.find(({ aliases }) => aliases.includes(modelName));
  if (!service) {
    return response.status(400).json({
      success: false,
      message: `Selected debate model service not found: ${modelName}`
    });
  }

  // Custom key override mapping
  let customKey = null;
  if (customKeys) {
    if (service.model === 'Gemini Flash') customKey = customKeys.GEMINI_API_KEY;
    else if (service.model === 'Liquid LFM') customKey = customKeys.OPENROUTER_API_KEY;
    else if (service.model === 'Qwen HF') customKey = customKeys.HUGGINGFACE_API_KEY;
    else if (service.model === 'Groq') customKey = customKeys.GROQ_API_KEY;
    else if (service.model === 'Cohere') customKey = customKeys.COHERE_API_KEY;
  }

  try {
    const text = await service.ask(contextPrompt, customKey);
    return response.json({
      success: true,
      text: text.trim()
    });
  } catch (err) {
    console.error(`Debate turn execution failed for model ${modelName}:`, err);
    return response.json({
      success: true,
      text: `[${modelName} experienced a connection issue and was unable to respond to this round.]`
    });
  }
}

export async function debateSummary(request, response) {
  const { topic, transcript, customKeys } = request.body;

  if (!topic || !Array.isArray(transcript) || transcript.length === 0) {
    return response.status(400).json({
      success: false,
      message: 'Topic and transcript are required for debate summary synthesis'
    });
  }

  const systemPrompt = `You are a professional debate judge.
Analyze the following debate transcript on the topic: "${topic}".
Provide a final summary of the arguments and suggest a winner (either the Positive side or Negative side) with a brief, clear reason based on the strength of their arguments.

Provide your output in Markdown, structured exactly as follows:
# Debate Summary
[Insert summary of the debate, highlighting key arguments from both sides]

# Suggested Winner
🏆 **[Positive / Negative / Tie]** (Represented by [Model name])

# Winner Analysis
[Insert 2-3 sentences explaining why this side won the debate]

Debate Transcript:
${transcript.map((t) => `[${t.model} (${t.role.toUpperCase()})]: ${t.text}`).join('\n\n')}`;

  try {
    const result = await askGeminiWithFallback(systemPrompt, 'google/gemini-2.5-flash', customKeys);
    if (!isUsableResponseText(result.response)) {
      throw new Error('Summary judge returned an unavailable response');
    }
    return response.json({
      success: true,
      summary: result.response,
      fallbackUsed: result.fallbackUsed
    });
  } catch (err) {
    console.error('Debate summary generation failed:', err);
    const positive = transcript.filter((t) => String(t.role).toLowerCase() === 'user').map((t) => t.text).join(' ');
    const negative = transcript.filter((t) => String(t.role).toLowerCase() === 'ai').map((t) => t.text).join(' ');
    const winner = positive.length === negative.length ? 'Tie' : positive.length > negative.length ? 'Positive' : 'Negative';

    return response.json({
      success: true,
      summary: `# Debate Summary\nThe debate explored "${topic}" from both sides. The Positive side focused on supporting arguments, while the Negative side challenged those claims with rebuttals and counterpoints.\n\n# Suggested Winner\n**${winner}**\n\n# Winner Analysis\nThe automated judge service was unavailable, so this is a lightweight fallback verdict based on the amount of usable argument content captured in the transcript. Review the debate transcript above for the final human decision.`,
      fallbackUsed: true
    });
  }
}
