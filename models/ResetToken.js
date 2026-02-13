const mongoose = require('mongoose');

const resetTokenSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true
    },
    otp: {
        type: String,
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    used: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 900 // 15 minutes TTL
    }
});

resetTokenSchema.index({ email: 1 });

module.exports = mongoose.model('ResetToken', resetTokenSchema);
