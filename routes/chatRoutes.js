const express = require('express');
const { accessChat, fetchChats, getMessages, uploadChatFile } = require('../controllers/chatController');
const protect = require('../middleware/authMiddleware');
const chatUpload = require('../middleware/chatUpload');

const router = express.Router();

router.use(protect);

router.route('/')
  .post(accessChat)
  .get(fetchChats);

router.route('/:chatId/messages')
  .get(getMessages);

router.post('/:chatId/upload', chatUpload.single('file'), uploadChatFile);

module.exports = router;