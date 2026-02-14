require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const multer = require("multer");

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const chatRoutes = require('./routes/chatRoutes');
const protect = require('./middleware/authMiddleware');

const Message = require('./models/Message');
const Chat = require('./models/Chat');
const Item = require('./models/Item');

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

connectDB();

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(helmet());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/chats', chatRoutes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
});

// Socket.IO Auth Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  } else {
    next(new Error("Authentication error"));
  }
});

// Socket.IO Connection
io.on('connection', async (socket) => {
  console.log('🔌 User Connected:', socket.user.email);
  const userId = socket.user.id || socket.user._id;

  // Auto-join all user's chat rooms
  try {
    const userChats = await Chat.find({ participants: userId }).select('_id');
    userChats.forEach(chat => {
      socket.join(chat._id.toString());
    });
  } catch (err) {
    console.error("Auto join error:", err);
  }

  // Manual join
  socket.on("join_chat", async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) return;

      const isMember = chat.participants.some(
        (p) => p.toString() === userId
      );
      if (!isMember) {
        socket.emit("socket_error", { message: "Unauthorized chat access" });
        return;
      }
      socket.join(chatId);
    } catch (err) {
      console.error("Join error:", err);
    }
  });

  // Send message (supports text, image, file)
  // chatId can be a real Chat _id OR an Item _id (lazy creation)
  socket.on('send_message', async (data) => {
    const { chatId: rawId, content, type, fileUrl, fileName, mimeType } = data;

    let chat = await Chat.findById(rawId).populate('item', 'status');

    // If no chat found, treat rawId as an itemId and create the chat lazily
    if (!chat) {
      try {
        const item = await Item.findById(rawId);
        if (!item) {
          socket.emit("socket_error", { message: "Item not found" });
          return;
        }
        if (item.seller.toString() === userId) {
          socket.emit("socket_error", { message: "Cannot chat about your own item" });
          return;
        }
        if (item.status === 'deleted') {
          socket.emit("socket_error", { message: "This item has been removed" });
          return;
        }

        // Find existing chat or create a new one
        chat = await Chat.findOne({
          item: rawId,
          participants: { $all: [userId, item.seller], $size: 2 }
        }).populate('item', 'status');

        if (!chat) {
          chat = await Chat.create({
            item: rawId,
            participants: [userId, item.seller],
            lastMessageAt: Date.now()
          });
          chat = await Chat.findById(chat._id).populate('item', 'status');
        }

        // Join sender to the new chat room
        socket.join(chat._id.toString());

        // Join the seller to the chat room if they are online
        const sellerSockets = await io.fetchSockets();
        for (const s of sellerSockets) {
          if (s.user && (s.user.id === item.seller.toString() || s.user._id === item.seller.toString())) {
            s.join(chat._id.toString());
          }
        }

        // Notify the sender about the real chat id so the frontend can redirect
        socket.emit("chat_created", {
          chatId: chat._id.toString(),
          itemId: rawId
        });
      } catch (err) {
        console.error("Lazy chat creation error:", err);
        socket.emit("socket_error", { message: "Failed to create chat" });
        return;
      }
    }

    const realChatId = chat._id.toString();

    const isMember = chat.participants.some(
      (p) => p.toString() === userId
    );
    if (!isMember) {
      socket.emit("socket_error", { message: "Unauthorized chat access" });
      return;
    }

    // Block sending if item is deleted
    if (chat.item && chat.item.status === 'deleted') {
      socket.emit("socket_error", { message: "This chat is read-only — item has been deleted" });
      return;
    }

    try {
      const msgType = type || 'text';
      const msgContent = content || (msgType === 'image' ? '📷 Image' : '📎 File');

      const newMessage = await Message.create({
        sender: userId,
        chatId: realChatId,
        content: msgContent,
        type: msgType,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        mimeType: mimeType || undefined
      });

      const lastMsgText = msgType === 'text' ? content : (msgType === 'image' ? '📷 Image' : `📎 ${fileName || 'File'}`);

      await Chat.findByIdAndUpdate(realChatId, {
        lastMessage: lastMsgText,
        lastMessageAt: Date.now(),
        latestMessage: newMessage._id
      });

      const fullMessage = await newMessage.populate('sender', 'email role');

      io.to(realChatId).emit('receive_message', fullMessage);
    } catch (error) {
      console.error('Socket Error:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('User Disconnected');
  });
});

app.get('/api/test-protected', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Protected route accessed successfully!',
    user: req.user
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});