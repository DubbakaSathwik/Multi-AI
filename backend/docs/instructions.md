# Multi-AI Response Interface & Comparison Platform

## Abstract

MultiAI is a plain HTML/CSS/JavaScript application with a Node.js, Express, and MongoDB backend. It lets a user send one prompt to multiple AI providers, compare responses side by side, run model debates, generate personas, select a best response, vote on outputs, and review usage insights.

The project intentionally keeps the frontend lightweight: no React, no Vite, no Tailwind, and no Python project code.

## Current Stack

Frontend:

- HTML
- CSS
- JavaScript
- Font Awesome icons loaded by the page

Backend:

- Node.js
- Express.js
- Axios
- dotenv
- cors
- helmet
- compression
- express-rate-limit
- jsonwebtoken
- bcryptjs
- mongoose

Database:

- MongoDB

## Folder Structure

```text
Multi-AI/
  frontend/
    index.html
    login.html

  backend/
    config/
      env.js
    controllers/
      ai.controller.js
    middlewares/
      auth.middleware.js
      error.middleware.js
      rateLimit.middleware.js
      validation.middleware.js
    models/
      apiUsage.model.js
      conversation.model.js
      persona.model.js
      profile.model.js
      responseFeedback.model.js
      user.model.js
      userSettings.model.js
    routes/
      ai.routes.js
      auth.routes.js
      feedback.routes.js
      user.routes.js
      workspace.routes.js
    services/
      auxiliary.service.js
      cohere.service.js
      gemini.service.js
      groq.service.js
      huggingface.service.js
      liquid.service.js
      openrouter.service.js
    docs/
      instructions.md
      project_details.md
    .env.example
    package.json
    server.js
```

## Environment Variables

Use `backend/.env`. Do not hardcode or commit real keys.

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/multi-ai
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5000,http://127.0.0.1:5000

GEMINI_API_KEY=
OPENROUTER_API_KEY=
HUGGINGFACE_API_KEY=
GROQ_API_KEY=
COHERE_API_KEY=
```

## AI Providers

- Gemini Flash: Google Gemini API, `GEMINI_API_KEY`
- Liquid LFM: OpenRouter, `OPENROUTER_API_KEY`
- Qwen HF: Hugging Face Router, `HUGGINGFACE_API_KEY`
- Groq: Groq Llama endpoint, `GROQ_API_KEY`
- Cohere: Cohere Command endpoint, `COHERE_API_KEY`

Gemini can fail with `RESOURCE_EXHAUSTED` when the free quota is exceeded. That is a provider quota issue, not a frontend rendering issue. The backend returns structured failure text and the best-response selector ignores unavailable responses.

## Main Features Built

- One-command server: `node server.js` from `backend`
- Static frontend served from `frontend`
- Login/register with JWT
- Multi-model chat endpoint
- Per-model parameters
- Follow-up query per response card
- Typewriter response rendering
- Markdown-style rendering for model output
- Best-response selection with fallback logic
- Prompt optimization
- Persona auto-generation
- Custom persona create/edit/delete
- Debate arena with summary toggle
- Feedback voting with MongoDB aggregation
- Profile persistence
- Settings persistence
- Persona persistence
- Conversation history persistence
- API usage telemetry for model latency/status
- Health check endpoint
- Readiness endpoint for deployment
- Security middleware, rate limits, compression, and environment validation

## Main API Endpoints

```text
GET  /api/health
GET  /api/ready

POST /api/auth/register
POST /api/auth/login

POST /api/ai/chat
GET  /api/ai/diagnostics/gemini
POST /api/ai/best-response
POST /api/ai/consensus
POST /api/ai/optimize
POST /api/ai/persona
POST /api/ai/debate/step
POST /api/ai/debate/summary

GET    /api/feedback/stats
POST   /api/feedback/vote
DELETE /api/feedback/vote
DELETE /api/feedback/client/:clientId

GET /api/workspace/profile
PUT /api/workspace/profile
GET /api/workspace/settings
PUT /api/workspace/settings
GET /api/workspace/personas
PUT /api/workspace/personas
GET /api/workspace/history
PUT /api/workspace/history
GET /api/workspace/usage
```

## How To Start

```bash
cd backend
npm install
node server.js
```

Open:

```text
http://localhost:5000/index.html
```

Test backend:

```bash
curl http://localhost:5000/api/health
```

Expected:

```json
{ "status": "ok" }
```

## Production Readiness Notes

- Keep `.env` private.
- Use `.env.example` for documentation only.
- Set a strong `JWT_SECRET` before deployment.
- Configure `CORS_ORIGIN` for deployed domains.
- Use MongoDB Atlas or a managed MongoDB instance for deployment.
- Add HTTPS through hosting platform or reverse proxy.
- Add CI smoke tests before final submission.
- BYOK keys are session-only in the browser and should not be stored permanently.
- Docker deployment is supported from the project root with the included `Dockerfile`.
