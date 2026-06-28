import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    clientId: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    displayName: { type: String, default: 'Guest', trim: true },
    email: { type: String, default: 'guest@multiai.system', trim: true, lowercase: true },
    mobile: { type: String, default: '', trim: true },
    role: { type: String, default: '', trim: true },
    bio: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

profileSchema.index({ clientId: 1 }, { unique: true, sparse: true });
profileSchema.index({ userId: 1 }, { unique: true, sparse: true });

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;
