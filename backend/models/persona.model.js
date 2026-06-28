import mongoose from 'mongoose';

const personaSchema = new mongoose.Schema(
  {
    clientId: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    name: { type: String, required: true, trim: true },
    desc: { type: String, required: true, trim: true },
    systemPrompt: { type: String, required: true },
    icon: { type: String, default: 'fa-solid fa-user-gear' },
    isCustom: { type: Boolean, default: true }
  },
  { timestamps: true }
);

personaSchema.index({ clientId: 1, name: 1 });
personaSchema.index({ userId: 1, name: 1 });

const Persona = mongoose.model('Persona', personaSchema);
export default Persona;
