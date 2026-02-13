const User = require('../models/User');
const Otp = require('../models/Otp');
const ResetToken = require('../models/ResetToken');
const sendEmail = require('../utils/emailService');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// @desc    Request OTP
// @route   POST /api/auth/request-otp
// @access  Public
exports.requestOtp = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.endsWith('@iitk.ac.in')) {
    return res.status(400).json({ success: false, message: 'Only @iitk.ac.in emails are allowed.' });
  }

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    await Otp.findOneAndUpdate(
      { email },
      { otp: hashedOtp, createdAt: Date.now() },
      { upsert: true, new: true }
    );

    const emailSent = await sendEmail(email, 'IITK Marketplace Login OTP', otp);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send email.' });
    }

    res.status(200).json({ success: true, message: `OTP sent to ${email}` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord)
      return res.status(400).json({ message: 'OTP expired or not found' });

    const isMatch = await bcrypt.compare(otp, otpRecord.otp);

    if (!isMatch)
      return res.status(400).json({ message: 'Invalid OTP' });

    otpRecord.verified = true;
    await otpRecord.save();

    res.status(200).json({
      success: true,
      message: 'OTP verified. Proceed to set password.'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const otpRecord = await Otp.findOne({ email });

    if (!otpRecord || !otpRecord.verified)
      return res.status(400).json({ message: 'OTP not verified' });

    const existing = await User.findOne({ email });

    if (existing)
      return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({
      email,
      password,
      isVerified: true
    });

    await Otp.deleteMany({ email });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select('+password');

    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.status(400).json({ message: 'Invalid credentials' });

    user.lastLogin = Date.now();
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Forgot Password - send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email' });
    }

    // Invalidate all previous reset OTPs for this email
    await ResetToken.deleteMany({ email });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const salt = await bcrypt.genSalt(10);
    const hashedOtp = await bcrypt.hash(otp, salt);

    await ResetToken.create({
      email,
      otp: hashedOtp,
      attempts: 0,
      used: false
    });

    const emailSent = await sendEmail(
      email,
      'IITK Marketplace - Password Reset OTP',
      otp
    );

    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send email' });
    }

    res.status(200).json({
      success: true,
      message: `Password reset OTP sent to ${email}`
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Reset Password - verify OTP and set new password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, OTP, and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters'
    });
  }

  try {
    const resetToken = await ResetToken.findOne({ email, used: false });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: 'No valid reset OTP found. Please request a new one.'
      });
    }

    // Check max attempts (5)
    if (resetToken.attempts >= 5) {
      await ResetToken.deleteMany({ email });
      return res.status(400).json({
        success: false,
        message: 'Too many attempts. Please request a new OTP.'
      });
    }

    // Increment attempts
    resetToken.attempts += 1;
    await resetToken.save();

    const isMatch = await bcrypt.compare(otp, resetToken.otp);

    if (!isMatch) {
      const remaining = 5 - resetToken.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt(s) remaining.`
      });
    }

    // OTP is correct — mark as used
    resetToken.used = true;
    await resetToken.save();

    // Update user password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    // Invalidate all reset tokens for this email
    await ResetToken.deleteMany({ email });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login.'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Change password (while logged in)
// @route   POST /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters'
    });
  }

  try {
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};