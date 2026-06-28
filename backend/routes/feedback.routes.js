import { Router } from 'express';
import mongoose from 'mongoose';
import ResponseFeedback from '../models/responseFeedback.model.js';
import { getOptionalUserId } from '../utils/auth.js';
import { validateClientId } from '../middlewares/validation.middleware.js';

const router = Router();

const knownModels = ['Gemini Flash', 'Liquid LFM', 'Qwen HF', 'Groq', 'Cohere'];

function emptyStats() {
  return knownModels.reduce(
    (stats, model) => {
      stats.likes[model] = 0;
      stats.dislikes[model] = 0;
      return stats;
    },
    { likes: {}, dislikes: {} }
  );
}

async function getAggregateStats(clientId) {
  const stats = emptyStats();
  const matchStage = clientId ? { $match: { clientId } } : { $match: {} };
  const rows = await ResponseFeedback.aggregate([
    matchStage,
    {
      $group: {
        _id: { model: '$model', vote: '$vote' },
        count: { $sum: 1 }
      }
    }
  ]);

  rows.forEach((row) => {
    const model = row._id.model;
    const vote = row._id.vote;
    if (vote === 'like') stats.likes[model] = row.count;
    if (vote === 'dislike') stats.dislikes[model] = row.count;
  });

  return stats;
}

router.get('/stats', validateClientId, async (request, response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.',
        ...emptyStats()
      });
    }

    const clientId = request.query.clientId;
    const stats = await getAggregateStats(clientId);
    response.json({ success: true, ...stats });
  } catch (error) {
    console.error('Feedback stats error:', error);
    response.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/vote', validateClientId, async (request, response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.'
      });
    }

    const { clientId, responseKey, model, prompt, response: responseText, vote } = request.body;

    if (
      !clientId ||
      !responseKey ||
      !model ||
      !prompt ||
      !responseText ||
      !['like', 'dislike'].includes(vote)
    ) {
      return response.status(400).json({ success: false, message: 'Invalid feedback payload' });
    }

    await ResponseFeedback.findOneAndUpdate(
      { clientId, responseKey },
      {
        clientId,
        responseKey,
        model,
        prompt,
        response: responseText,
        vote,
        userId: getOptionalUserId(request)
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const stats = await getAggregateStats(clientId);
    response.json({ success: true, ...stats });
  } catch (error) {
    console.error('Feedback vote error:', error);
    response.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/vote', validateClientId, async (request, response) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.'
      });
    }

    const { clientId, responseKey } = request.body;

    if (!clientId || !responseKey) {
      return response.status(400).json({ success: false, message: 'Invalid feedback payload' });
    }

    await ResponseFeedback.deleteOne({ clientId, responseKey });

    const stats = await getAggregateStats(clientId);
    response.json({ success: true, ...stats });
  } catch (error) {
    console.error('Feedback delete error:', error);
    response.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/client/:clientId', async (request, response) => {
  try {
    if (!/^[a-zA-Z0-9._:-]{1,120}$/.test(request.params.clientId || '')) {
      return response.status(400).json({ success: false, message: 'A valid clientId is required.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return response.status(503).json({
        success: false,
        message: 'Database is currently offline. Please ensure MongoDB is started.'
      });
    }

    await ResponseFeedback.deleteMany({ clientId: request.params.clientId });

    response.json({ success: true, ...emptyStats() });
  } catch (error) {
    console.error('Feedback reset error:', error);
    response.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
