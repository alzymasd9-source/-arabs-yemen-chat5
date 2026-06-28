const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'yemen_secret_key_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== قاعدة البيانات =====
mongoose.connect(MONGO_URL).then(() => console.log('MongoDB Connected')).catch(err => console.log(err));

// 1. نظام المستخدمين + الرتب + الملف الشخصي
const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  password: String,
  gender: String,
  age: Number,
  rank: { type: String, default: 'عضو' }, // عضو, مشرف, اداري, مالك
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
  country: { type: String, default: 'اليمن' },
  createdAt: { type: Date, default: Date.now },
  isBanned: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

// 2. الرسائل
const MessageSchema = new mongoose.Schema({ room: String, userId: mongoose.Schema.Types.ObjectId, name: String, rank: String, msg: String, time: { type: Date, default: Date.now } });
const Message = mongoose.model('Message', MessageSchema);

// 3. الغرف
const RoomSchema = new mongoose.Schema({ name: String, type: String, password: { type: String, default: '' } });
const Room = mongoose.model('Room', RoomSchema);

// ===== صلاحيات الرتب =====
const ranks = {
  'زائر': 0,
  'عضو': 1,
  'مشرف': 2, // كتم، حذف رسائل
  'اداري': 3, // طرد، حظر
  'مالك': 4 // كل الصلاحيات + اضافة اداريين
};
const hasPermission = (userRank, neededRank) => ranks[userRank] >= ranks[neededRank];

// ===== تسجيل + دخول =====
app.post('/api/register', async (req, res) => {
  const { name, password, gender, age } = req.body;
  if (await User.findOne({ name })) return res.status(400).json({ error: 'الاسم موجود' });
  const hash = await bcrypt.hash(password, 10);
  const isFirst = (await User.countDocuments()) === 0;
  const user = await User.create({ name, password: hash, gender, age, rank: isFirst? 'مالك' : 'عضو' });
  const token = jwt.sign({ id: user._id, rank: user.rank }, JWT_SECRET);
  res.json({ token, user: { name: user.name, rank: user.rank, gender: user.gender, age: user.age } });
});

app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  const user = await User.findOne({ name });
  if (!user ||!(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'خطأ في الدخول' });
  if (user.isBanned) return res.status(403).json({ error: 'محظور' });
  const token = jwt.sign({ id: user._id, rank: user.rank }, JWT_SECRET);
  res.json({ token, user: { name: user.name, rank: user.rank, gender: user.gender, age: user.age, avatar: user.avatar, bio: user.bio } });
});

// ===== ملف شخصي - تعديل وتغير =====
app.post('/api/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = jwt.verify(token, JWT_SECRET);
  const { avatar, bio, age } = req.body;
  await User.findByIdAndUpdate(data.id, { avatar, bio, age });
  res.json({ success: true });
});

// ===== نظام الغرف =====
app.get('/init', async (req, res) => {
  const rooms = [ { name: 'عام اليمن', type: 'عام' }, { name: 'صنعاء', type: 'محافظات' }, { name: 'عدن', type: 'محافظات' }, { name: 'تعز', type: 'محافظات' }, { name: 'VIP', type: 'خاص' } ];
  await Room.deleteMany({});
  await Room.insertMany(rooms);
  res.send('تم انشاء الغرف');
});
app.get('/api/rooms', async (req, res) => { res.json(await Room.find({})); });
app.get('/api/messages/:room', async (req, res) => { res.json((await Message.find({ room: req.params.room }).limit(100).sort({ time: -1 })).reverse()); });

// ===== لوحة تحكم المالك - كامل الصلاحيات =====
const auth = (rank) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const data = jwt.verify(token, JWT_SECRET);
    if (!hasPermission(data.rank, rank)) return res.status(403).json({ error: 'ممنوع' });
    req.user = data;
    next();
  } catch { res.status(401).json({ error: 'غير مصرح' }); }
};

app.post('/api/admin/setRank', auth('مالك'), async (req, res) => {
  const { name, rank } = req.body;
  await User.updateOne({ name }, { rank });
  res.json({ success: true });
});
app.post('/api/admin/ban', auth('اداري'), async (req, res) => {
  await User.updateOne({ name: req.body.name }, { isBanned: true });
  res.json({ success: true });
});
app.post('/api/admin/unban', auth('اداري'), async (req, res) => {
  await User.updateOne({ name: req.body.name }, { isBanned: false });
  res.json({ success: true });
});
app.post('/api/admin/clearUser', auth('مشرف'), async (req, res) => {
  await Message.deleteMany({ name: req.body.name });
  res.json({ success: true });
});
app.post('/api/admin/createRoom', auth('اداري'), async (req, res) => {
  await Room.create({ name: req.body.name, type: req.body.type, password: req.body.password || '' });
  res.json({ success: true });
});
app.post('/api/admin/deleteRoom', auth('اداري'), async (req, res) => {
  await Room.deleteOne({ name: req.body.name });
  res.json({ success: true });
});

// ===== Socket.IO مع دعم الزوار =====
const onlineUsers = {}; // {socketId: {id, name, rank, room, gender, age}}

io.on('connection', (socket) => {
  socket.on('join', async (data) => {
    let user;

    // 1. لو زائر: نسوي له حساب مؤقت بدون ما نحفظه في DB
    if(data.rank === 'زائر'){
      user = {
        _id: socket.id,
        name: data.name || 'زائر'+Math.floor(Math.random()*1000),
        rank: 'زائر',
        gender: data.gender,
        age: data.age
      };
    }
    // 2. لو عضو: نجيبه من قاعدة البيانات
    else {
      if(!data.userId) return socket.emit('error', 'خطأ دخول');
      user = await User.findById(data.userId);
      if (!user || user.isBanned) return socket.emit('error', 'محظور');
    }

    onlineUsers[socket.id] = { id: user._id, name: user.name, rank: user.rank, room: data.room, gender: user.gender, age: user.age };
    socket.join(data.room);
    io.to(data.room).emit('system', `${user.name} [${user.rank}] دخل`);
    io.to(data.room).emit('users', Object.values(onlineUsers).filter(u => u.room === data.room));
  });

  socket.on('chatMessage', async (data) => {
    const user = onlineUsers[socket.id]; if (!user) return;
    // الزائر ما نحفظ رسائله عشان ما نثقل قاعدة البيانات
    if(user.rank!== 'زائر'){
      await Message.create({ room: user.room, userId: user.id, name: user.name, rank: user.rank, msg: data.msg });
    }
    io.to(user.room).emit('message', { name: user.name, rank: user.rank, gender: user.gender, age: user.age, msg: data.msg, time: new Date() });
  });

  // كتم - صلاحية مشرف وفوق
  socket.on('mute', async (data) => {
    const admin = onlineUsers[socket.id]; if (!admin ||!hasPermission(admin.rank, 'مشرف')) return;
    io.to(data.targetId).emit('muted', data.time); // بالثواني
  });

  // طرد - صلاحية اداري وفوق
  socket.on('kick', async (data) => {
    const admin = onlineUsers[socket.id]; if (!admin ||!hasPermission(admin.rank, 'اداري')) return;
    io.sockets.sockets.get(data.targetId)?.disconnect(true);
  });

  socket.on('disconnect', () => {
    const user = onlineUsers[socket.id];
    if (user) {
      io.to(user.room).emit('system', `${user.name} خرج`);
      delete onlineUsers[socket.id];
      io.to(user.room).emit('users', Object.values(onlineUsers).filter(u => u.room === user.room));
    }
  });
});

server.listen(PORT, () => console.log(`Server ON on port ${PORT}`));