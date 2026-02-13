const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-zA-Z0-9._%+-]+@iitk\.ac\.in$/, 'Please use a valid IITK email']
  },

  password: {
    type: String,
    select: false
  },

  role: {
    type: String,
    enum: ['student', 'faculty', 'admin'],
    default: 'student'
  },

  isVerified: {
    type: Boolean,
    default: false
  },

  lastLogin: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

module.exports = mongoose.model('User', userSchema);