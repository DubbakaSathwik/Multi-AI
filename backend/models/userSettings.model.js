import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema(
  {
    clientId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    activeExpertise: { type: String, default: 'Neutral' },
    bestResponsePreference: { type: String, default: 'balanced' },
    sidebarPosition: { type: String, default: 'right' },
    modelParameters: { type: mongoose.Schema.Types.Mixed, default: {} },
    byokEnabled: { type: Boolean, default: false }
  },
  { timestamps: true }
);

userSettingsSchema.index({ clientId: 1 }, { unique: true, sparse: true });
userSettingsSchema.index({ userId: 1 }, { unique: true, sparse: true });

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);
export default UserSettings;
