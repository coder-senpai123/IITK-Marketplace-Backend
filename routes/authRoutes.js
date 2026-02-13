const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');

const {
  requestOtp,
  verifyOtp,
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword
} = require('../controllers/authController');

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/change-password', protect, changePassword);

module.exports = router;