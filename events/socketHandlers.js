const Message = require('../models/Message');
const User = require('../models/User');
const Report = require('../models/Report');
const Room = require('../models/Room');

const activeUsers = new Map();
const typingUsers = new Map();

const badWords = [
  'كلمة سيئة 1',
  'كلمة سيئة 2',
  'شتيمة',
  'سب'
];

const containsBadWords = (text) => {
  return badWords.some(word => text.includes(word));
};

module.exports = (io, socket) => {
  // دخول الغرفة
  socket.on('joinRoom', async (data) => {
    try {
      socket.join(data.roomId);
      
      activeUsers.set(socket.id, {
        userId: data.userId,
        username: data.username,
        rank: data.rank,
        room: data.roomId,
        socketId: socket.id
      });

      // تحديث قائمة المتواجدين
      const roomUsers = Array.from(activeUsers.values())
        .filter(u => u.room === data.roomId);

      io.to(data.roomId).emit('updateOnlineUsers', roomUsers);

      // رسالة نظام
      io.to(data.roomId).emit('receiveMessage', {
        system: true,
        content: `${data.username} دخل الغرفة`,
        timestamp: new Date()
      });

      // تحديث عدد المتواجدين
      const room = await Room.findOneAndUpdate(
        { roomId: data.roomId },
        { currentUsers: roomUsers.length }
      );
    } catch (error) {
      console.error(error);
    }
  });

  // إرسال رسالة
  socket.on('sendMessage', async (data) => {
    try {
      let content = data.content;

      // التحقق من الكلمات السيئة
      if (containsBadWords(content)) {
        content = 'محتوى مسيء - تم حذفه بواسطة الاعتدال الآلي';
      }

      const message = await Message.create({
        roomId: data.roomId,
        userId: data.userId,
        username: data.username,
        userRank: data.rank,
        userGender: data.gender,
        userAvatar: data.avatar,
        content: content,
        type: 'text',
        timestamp: new Date()
      });

      // زيادة الرصيد للمستخدم
      const Credit = require('../models/Credit');
      await Credit.findOneAndUpdate(
        { userId: data.userId },
        {
          $inc: { balance: 1 },
          $push: {
            transactions: {
              type: 'earn',
              amount: 1,
              reason: 'تفاعل في الشات',
              timestamp: new Date()
            }
          }
        }
      );

      io.to(data.roomId).emit('receiveMessage', {
        id: message._id,
        userId: data.userId,
        username: data.username,
        rank: data.rank,
        gender: data.gender,
        avatar: data.avatar,
        content: message.content,
        type: 'text',
        timestamp: message.timestamp
      });
    } catch (error) {
      console.error(error);
    }
  });

  // الإبلاغ عن رسالة
  socket.on('reportMessage', async (data) => {
    try {
      const report = await Report.create({
        reportedBy: data.reportedBy,
        messageId: data.messageId,
        reason: data.reason,
        roomId: data.roomId,
        timestamp: new Date()
      });

      io.emit('newReport', {
        id: report._id,
        message: `تقرير جديد`,
        priority: 'medium'
      });
    } catch (error) {
      console.error(error);
    }
  });

  // كتابة رسالة (يكتب الآن)
  socket.on('typing', (data) => {
    typingUsers.set(socket.id, data.username);
    io.to(data.roomId).emit('userTyping', {
      username: data.username,
      isTyping: true
    });
  });

  socket.on('stopTyping', (data) => {
    typingUsers.delete(socket.id);
    io.to(data.roomId).emit('userTyping', {
      username: data.username,
      isTyping: false
    });
  });

  // غادر الغرفة
  socket.on('leaveRoom', (data) => {
    socket.leave(data.roomId);
    const user = activeUsers.get(socket.id);
    
    if (user) {
      io.to(data.roomId).emit('receiveMessage', {
        system: true,
        content: `${user.username} غادر الغرفة`,
        timestamp: new Date()
      });
    }
    
    activeUsers.delete(socket.id);
  });

  // قطع الاتصال
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    
    if (user) {
      io.to(user.room).emit('receiveMessage', {
        system: true,
        content: `${user.username} قطع الاتصال`,
        timestamp: new Date()
      });
    }
    
    activeUsers.delete(socket.id);
    typingUsers.delete(socket.id);
  });

  // إضافة صديق
  socket.on('addFriend', async (data) => {
    try {
      const user = await User.findByIdAndUpdate(
        data.userId,
        { $push: { friends: data.friendId } },
        { new: true }
      );

      const friend = await User.findByIdAndUpdate(
        data.friendId,
        { $push: { friends: data.userId } },
        { new: true }
      );

      socket.emit('friendAdded', { success: true });
    } catch (error) {
      socket.emit('friendAdded', { success: false, error: error.message });
    }
  });

  // الإعجاب
  socket.on('likeUser', async (data) => {
    try {
      const user = await User.findByIdAndUpdate(
        data.likedUserId,
        { $inc: { likes: 1 } },
        { new: true }
      );

      io.to(data.roomId).emit('userLiked', {
        userId: data.likedUserId,
        likes: user.likes
      });
    } catch (error) {
      console.error(error);
    }
  });
};
