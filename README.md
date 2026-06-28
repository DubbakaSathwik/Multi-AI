# MultiAI Response Interface & Comparison Platform

MultiAI is a plain HTML/CSS/JavaScript frontend with a Node.js, Express, and MongoDB backend. It sends one prompt to multiple AI providers, compares responses, runs debates, generates personas, selects a best response, records feedback, and persists profile/settings/history data.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js, Axios
- Database: MongoDB with Mongoose
- Security/runtime: Helmet, CORS, compression, rate limiting, JWT, bcrypt

## Main Features

- Multi-model AI response workspace
- Gemini, OpenRouter/Liquid, Hugging Face/Qwen, Groq, and Cohere service support
- Per-model response cards with copy, download, query, compare, like, and dislike actions
- Best-response selection
- AI debate arena with summary
- Prompt optimization
- Custom persona creation and AI-assisted persona drafting
- MongoDB-backed profile, settings, personas, conversation history, feedback, and usage telemetry
- JWT login/register plus guest mode

## Project Structure

```text
frontend/
  index.html
  login.html
  style.css

backend/
  config/
  controllers/
  middlewares/
  models/
  routes/
  services/
  utils/
  server.js
  package.json
```

## Environment Variables

Create `backend/.env` from `backend/.env.example`.

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

For production, `JWT_SECRET` and `CORS_ORIGIN` are required.

## Local Start

```bash
cd backend
npm install
node server.js
```

Open:

```text
http://localhost:5000/index.html
```

## Health Checks

```text
GET /api/health
GET /api/ready
```

`/api/health` confirms the server is alive. `/api/ready` confirms MongoDB is connected.

## Docker Deployment

Build:

```bash
docker build -t multiai .
```

Run:

```bash
docker run --env-file backend/.env -p 5000:5000 multiai
```

## Production Checklist

- Set `NODE_ENV=production`.
- Set a strong `JWT_SECRET`.
- Set `CORS_ORIGIN` to the deployed frontend/backend origin.
- Use MongoDB Atlas or another managed MongoDB instance.
- Keep `.env` out of Git.
- Check `/api/ready` after deployment.
- Rotate AI keys if they were ever exposed.
