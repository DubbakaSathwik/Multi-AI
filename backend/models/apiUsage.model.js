import mongoose from 'mongoose';

const apiUsageSchema = new mongoose.Schema(
  {
    clientId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    model: { type: String, required: true, index: true },
    latencyMs: { type: Number, default: 0 },
    status: { type: String, enum: ['success', 'failed'], default: 'success', index: true },
    feature: { type: String, default: 'chat' }
  },
  { timestamps: true }
);

apiUsageSchema.index({ clientId: 1, createdAt: -1 });
apiUsageSchema.index({ userId: 1, createdAt: -1 });

const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);
export default ApiUsage;
