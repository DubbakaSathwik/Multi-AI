import { Router } from 'express';
import mongoose from 'mongoose';
import Profile from '../models/profile.model.js';
import UserSettings from '../models/userSettings.model.js';
import Persona from '../models/persona.model.js';
import Conversation from '../models/conversation.model.js';
import ApiUsage from '../models/apiUsage.model.js';
import { getOptionalUserId, ownerQuery } from '../utils/auth.js';
import { validateClientId } from '../middlewares/validation.middleware.js';

const router = Router();
router.use(validateClientId);

function ensureDatabase(response) {
  if (mongoose.connection.readyState === 1) return true;
  response.status(503).json({
    success: false,
    message: 'Database is currently offline. Please ensure MongoDB is started.'
  });
  return false;
}

function getOwnerFields(request) {
  const userId = getOptionalUserId(request);
  const clientId = request.body?.clientId || request.query?.clientId;
  return userId ? { userId, clientId } : { clientId };
}

router.get('/profile', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const profile = await Profile.findOne(ownerQuery(request)).lean();
    response.json({ success: true, profile: profile || null });
  } catch (error) {
    console.error('Profile load error:', error);
    response.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

router.put('/profile', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const payload = {
      displayName: String(request.body.displayName || 'Guest').trim().slice(0, 80),
      email: String(request.body.email || 'guest@multiai.system').trim().toLowerCase().slice(0, 120),
      mobile: String(request.body.mobile || '').trim().slice(0, 30),
      role: String(request.body.role || '').trim().slice(0, 80),
      bio: String(request.body.bio || '').trim().slice(0, 500),
      ...getOwnerFields(request)
    };

    const profile = await Profile.findOneAndUpdate(ownerQuery(request), payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }).lean();

    response.json({ success: true, profile });
  } catch (error) {
    console.error('Profile save error:', error);
    response.status(500).json({ success: false, message: 'Failed to save profile.' });
  }
});

router.get('/settings', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const settings = await UserSettings.findOne(ownerQuery(request)).lean();
    response.json({ success: true, settings: settings || null });
  } catch (error) {
    console.error('Settings load error:', error);
    response.status(500).json({ success: false, message: 'Failed to load settings.' });
  }
});

router.put('/settings', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const payload = {
      theme: request.body.theme === 'light' ? 'light' : 'dark',
      activeExpertise: String(request.body.activeExpertise || 'Neutral').slice(0, 120),
      bestResponsePreference: String(request.body.bestResponsePreference || 'balanced').slice(0, 40),
      sidebarPosition: String(request.body.sidebarPosition || 'right').slice(0, 20),
      modelParameters: request.body.modelParameters && typeof request.body.modelParameters === 'object'
        ? request.body.modelParameters
        : {},
      byokEnabled: Boolean(request.body.byokEnabled),
      ...getOwnerFields(request)
    };

    const settings = await UserSettings.findOneAndUpdate(ownerQuery(request), payload, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }).lean();

    response.json({ success: true, settings });
  } catch (error) {
    console.error('Settings save error:', error);
    response.status(500).json({ success: false, message: 'Failed to save settings.' });
  }
});

router.get('/personas', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const personas = await Persona.find(ownerQuery(request)).sort({ updatedAt: -1 }).lean();
    response.json({ success: true, personas });
  } catch (error) {
    console.error('Personas load error:', error);
    response.status(500).json({ success: false, message: 'Failed to load personas.' });
  }
});

router.put('/personas', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const personas = Array.isArray(request.body.personas) ? request.body.personas.slice(0, 50) : [];
    const owner = ownerQuery(request);
    const ownerFields = getOwnerFields(request);

    const clientNames = personas
      .filter((persona) => persona?.name && persona?.desc && persona?.systemPrompt)
      .map(p => String(p.name).trim());

    // 1. Delete custom personas not in the client payload
    await Persona.deleteMany({
      ...owner,
      name: { $nin: clientNames }
    });

    // 2. Perform bulkWrite upserts
    if (clientNames.length > 0) {
      const ops = personas
        .filter((persona) => persona?.name && persona?.desc && persona?.systemPrompt)
        .map(persona => {
          const name = String(persona.name).trim().slice(0, 80);
          return {
            updateOne: {
              filter: { ...owner, name },
              update: {
                $set: {
                  desc: String(persona.desc).trim().slice(0, 220),
                  systemPrompt: String(persona.systemPrompt).trim().slice(0, 4000),
                  icon: String(persona.icon || 'fa-solid fa-user-gear').slice(0, 80),
                  isCustom: true,
                  ...ownerFields
                }
              },
              upsert: true
            }
          };
        });
      await Persona.bulkWrite(ops);
    }

    const saved = await Persona.find(owner).sort({ updatedAt: -1 }).lean();
    response.json({ success: true, personas: saved });
  } catch (error) {
    console.error('Personas save error:', error);
    response.status(500).json({ success: false, message: 'Failed to save personas.' });
  }
});

router.get('/history', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const conversations = await Conversation.find(ownerQuery(request)).sort({ updatedAt: -1 }).limit(100).lean();
    response.json({ success: true, conversations });
  } catch (error) {
    console.error('History load error:', error);
    response.status(500).json({ success: false, message: 'Failed to load history.' });
  }
});

router.put('/history', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const conversations = Array.isArray(request.body.conversations) ? request.body.conversations.slice(0, 100) : [];
    const owner = ownerQuery(request);
    const ownerFields = getOwnerFields(request);
    
    const clientLocalIds = conversations.map(chat => String(chat.id || chat.localId || ''));

    // 1. Delete ones not in the payload
    await Conversation.deleteMany({
      ...owner,
      localId: { $nin: clientLocalIds }
    });

    // 2. Perform bulkWrite upserts
    if (conversations.length > 0) {
      const ops = conversations.map(chat => {
        const localId = String(chat.id || chat.localId || '').slice(0, 120);
        return {
          updateOne: {
            filter: { ...owner, localId },
            update: {
              $set: {
                title: String(chat.title || 'Untitled Chat').slice(0, 120),
                isPinned: Boolean(chat.isPinned),
                activeModels: Array.isArray(chat.activeModels) ? chat.activeModels.slice(0, 10).map(String) : [],
                timestamp: chat.timestamp ? new Date(chat.timestamp) : new Date(),
                messages: chat.messages && typeof chat.messages === 'object' ? chat.messages : {},
                ...ownerFields
              }
            },
            upsert: true
          }
        };
      });
      await Conversation.bulkWrite(ops);
    }

    const saved = await Conversation.find(owner).sort({ updatedAt: -1 }).limit(100).lean();
    response.json({ success: true, conversations: saved });
  } catch (error) {
    console.error('History save error:', error);
    response.status(500).json({ success: false, message: 'Failed to save history.' });
  }
});

router.get('/usage', async (request, response) => {
  try {
    if (!ensureDatabase(response)) return;
    const query = ownerQuery(request);
    const rows = await ApiUsage.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$model',
          calls: { $sum: 1 },
          failures: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          averageLatencyMs: { $avg: '$latencyMs' }
        }
      }
    ]);
    response.json({ success: true, usage: rows });
  } catch (error) {
    console.error('Usage load error:', error);
    response.status(500).json({ success: false, message: 'Failed to load usage.' });
  }
});

export default router;
