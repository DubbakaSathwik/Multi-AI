import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    clientId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    title: { type: String, default: 'Untitled Chat', trim: true },
    localId: { type: String, index: true },
    isPinned: { type: Boolean, default: false },
    messages: { type: mongoose.Schema.Types.Mixed, default: {} },
    activeModels: { type: [String], default: [] },
    timestamp: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

conversationSchema.index({ clientId: 1, updatedAt: -1 });
conversationSchema.index({ userId: 1, updatedAt: -1 });
conversationSchema.index({ clientId: 1, localId: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
