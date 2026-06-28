import mongoose from 'mongoose';

const responseFeedbackSchema = new mongoose.Schema(
  {
    clientId: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    responseKey: { type: String, required: true },
    model: { type: String, required: true, index: true },
    prompt: { type: String, required: true },
    response: { type: String, required: true },
    vote: { type: String, enum: ['like', 'dislike'], required: true, index: true }
  },
  { timestamps: true }
);

responseFeedbackSchema.index({ clientId: 1, responseKey: 1 }, { unique: true });

const ResponseFeedback = mongoose.model('ResponseFeedback', responseFeedbackSchema);
export default ResponseFeedback;
