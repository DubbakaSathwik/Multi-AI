import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  likes: {
    type: Map,
    of: Number,
    default: {
      'Gemini Flash': 0,
      'Liquid LFM': 0,
      'Qwen HF': 0,
      'Groq': 0,
      'Cohere': 0
    }
  },
  dislikes: {
    type: Map,
    of: Number,
    default: {
      'Gemini Flash': 0,
      'Liquid LFM': 0,
      'Qwen HF': 0,
      'Groq': 0,
      'Cohere': 0
    }
  }
}, { timestamps: true });

// Hash the password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to verify passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
