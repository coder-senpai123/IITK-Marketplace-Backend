const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Item = require('../models/Item');
const cloudinary = require('cloudinary').v2;

/**
 * Stream a buffer to Cloudinary via upload_stream.
 * Returns the Cloudinary upload result.
 */
function streamUploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

// @desc    Create or fetch existing chat for a specific item
// @route   POST /api/chats
exports.accessChat = async (req, res) => {
  const { itemId } = req.body;

  if (!itemId) {
    return res.status(400).json({ success: false, message: 'Item ID required' });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Prevent chatting with self
    if (item.seller.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot chat about your own item' });
    }

    // Block chat on deleted items
    if (item.status === 'deleted') {
      return res.status(400).json({ success: false, message: 'This item has been removed' });
    }

    // Find existing chat for this item between these two users
    let chat = await Chat.findOne({
      item: itemId,
      participants: { $all: [req.user.id, item.seller], $size: 2 }
    })
      .populate('participants', 'email role')
      .populate('item', 'title price images status');

    if (chat) {
      return res.status(200).json({ success: true, data: chat });
    }

    // Create new chat
    const newChat = await Chat.create({
      item: itemId,
      participants: [req.user.id, item.seller],
      lastMessageAt: Date.now()
    });

    const fullChat = await Chat.findById(newChat._id)
      .populate('participants', 'email role')
      .populate('item', 'title price images status');

    res.status(201).json({ success: true, data: fullChat });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// @desc    Fetch all chats for logged-in user
// @route   GET /api/chats
exports.fetchChats = async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: { $in: [req.user.id] },
      latestMessage: { $ne: null }
    })
      .populate("participants", "email role")
      .populate("item", "title price images status")
      .populate({
        path: "latestMessage",
        populate: {
          path: "sender",
          select: "email"
        }
      })
      .sort({ lastMessageAt: -1 });

    res.status(200).json({ success: true, data: chats });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get messages for a chat
// @route   GET /api/chats/:chatId/messages
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chatId: req.params.chatId })
      .sort({ createdAt: 1 })
      .populate('sender', 'email role')
      .populate('chatId');

    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Upload a file in a chat
// @route   POST /api/chats/:chatId/upload
exports.uploadChatFile = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: 'Chat not found' });
    }

    // Only participants can upload
    const isMember = chat.participants.some(
      (p) => p.toString() === req.user.id
    );
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Not a participant of this chat' });
    }

    // Check if item is deleted (read-only chat)
    const item = await Item.findById(chat.item);
    if (item && item.status === 'deleted') {
      return res.status(400).json({ success: false, message: 'Cannot send files in this chat — item has been deleted' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const isImage = req.file.mimetype.startsWith('image');
    const type = isImage ? 'image' : 'file';

    // Upload to Cloudinary with correct resource_type
    const uploadOptions = {
      folder: 'iitk-marketplace/chat-files',
      resource_type: isImage ? 'image' : 'raw',
    };

    // For raw files (PDFs), include the original filename so the URL keeps the .pdf extension
    if (!isImage) {
      const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      uploadOptions.public_id = `${Date.now()}_${safeName}`;
    }

    const result = await streamUploadToCloudinary(req.file.buffer, uploadOptions);

    res.status(200).json({
      success: true,
      data: {
        type,
        fileUrl: result.secure_url,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Proxy-download a chat file (avoids Cloudinary raw access restrictions)
// @route   GET /api/chats/download
exports.downloadChatFile = async (req, res) => {
  const { url, name } = req.query;

  if (!url) {
    return res.status(400).json({ success: false, message: 'url query param required' });
  }

  // Only allow Cloudinary URLs for security
  if (!url.includes('res.cloudinary.com')) {
    return res.status(400).json({ success: false, message: 'Invalid file URL' });
  }

  try {
    // Extract public_id from Cloudinary raw URL
    // URL format: https://res.cloudinary.com/<cloud>/raw/upload/v<version>/<public_id>
    const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Could not parse Cloudinary URL' });
    }
    const publicId = match[1];

    // Generate a signed URL using the Cloudinary SDK
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      sign_url: true,
      secure: true,
      type: 'authenticated',
    });

    // Also try with type 'upload' and signed
    const signedUploadUrl = cloudinary.url(publicId, {
      resource_type: 'raw',
      sign_url: true,
      secure: true,
      type: 'upload',
    });

    const https = require('https');

    const fetchAndPipe = (targetUrl, fallbackUrl) => {
      https.get(targetUrl, (fileRes) => {
        // Follow redirects
        if ([301, 302, 303, 307, 308].includes(fileRes.statusCode) && fileRes.headers.location) {
          return fetchAndPipe(fileRes.headers.location, fallbackUrl);
        }

        if (fileRes.statusCode !== 200) {
          // Try fallback URL if primary fails
          if (fallbackUrl) {
            console.log(`Download proxy: trying fallback URL...`);
            return fetchAndPipe(fallbackUrl, null);
          }
          console.error(`Download proxy: Cloudinary returned ${fileRes.statusCode}`);
          return res.status(502).json({ success: false, message: 'Failed to fetch file from storage' });
        }

        const fileName = name || 'document';
        const contentType = fileRes.headers['content-type'] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

        fileRes.pipe(res);
      }).on('error', (err) => {
        console.error('Download proxy error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Download failed' });
        }
      });
    };

    fetchAndPipe(signedUploadUrl, signedUrl);
  } catch (error) {
    console.error('Download proxy error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};