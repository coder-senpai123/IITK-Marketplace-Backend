const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },

  otp: {
    type: String,
    required: true
  },

  verified: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300
  }
});

otpSchema.index({ email: 1 });

module.exports = mongoose.model('Otp', otpSchema);