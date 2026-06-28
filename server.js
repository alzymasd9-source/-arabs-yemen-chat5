const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 1e6, // 1MB
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'yemen_secret_key_2026';

app.use(helmet({contentSecurityPolicy: false}));
app.use(compression());
app.use(cors());
app.use(express.json({limit: '1mb'}));
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '1d'}));

// منع السبام: 100 طلب بالدقيقة
app.use('/api/', rateLimit({windowMs: 60000, max: 100}));

mongoose.connect(MONGO_URL, {maxPoolSize: 50}).then(() => console.log('MongoDB Connected')).catch(err => console.log(err));

const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true, index: true },
  password: String, gender: String, age: Number,
  rank: { type: String, default: 'عضو' },
  avatar: String, bio: String, country: {type: String, default: 'اليمن'},
  createdAt: { type: Date, default: Date.now, index: true },
  isBanned: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  room: {type: String, index: true}, userId: mongoose.Schema.Types.ObjectId,
  name: String, rank: String, gender: String, age: Number, msg: String,
  time: { type: Date, default: Date.now, index: true }
}, { capped: { size: 5242880, max: 10000 } }); // كاش اخر 10 الف رسالة فقط
const Message = mongoose.model('Message', MessageSchema);

const RoomSchema = new mongoose.Schema({ name: String, type: String, password: { type: String, default: '' } });
const Room = mongoose.model('Room', RoomSchema);

const ranks = {'زائر': 0,'عضو': 1,'مشرف': 2,'اداري': 3,'مالك': 4};
const hasPermission = (userRank, neededRank) => ranks[userRank] >= ranks[neededRank];

// تسجيل
app.post('/api/register', async (req, res) => {
  const { name, password, gender, age } = req.body;
  if(name.length<3) return res.status(400).json({ error: 'الاسم اقل شي 3 حروف' });
  if (await User.findOne({ name })) return res.status(400).json({ error: 'الاسم موجود' });
  const hash = await bcrypt.hash(password, 10);
  const isFirst = (await User.estimatedDocumentCount()) === 0;
  const user = await User.create({ name, password: hash, gender, age, rank: isFirst? 'مالك' : 'عضو' });
  const token = jwt.sign({ id: user._id, rank: user.rank }, JWT_SECRET, {expiresIn: '7d'});
  res.json({ token, user: { name: user.name, rank: user.rank, gender: user.gender, age: user.age } });
});

// دخول
app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  const user = await User.findOne({ name }).lean();
  if (!user ||!(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: 'خطأ في الدخول' });
  if (user.isBanned) return res.status(403).json({ error: 'محظور' });
  const token = jwt.sign({ id: user._id, rank: user.rank }, JWT_SECRET, {expiresIn: '7d'});
  res.json({ token, user: { name: user.name, rank: user.rank, gender: user.gender, age: user.age, avatar: user.avatar, bio: user.bio } });
});

// ملف شخصي
app.post('/api/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const data = jwt.verify(token, JWT_SECRET);
  const { avatar, bio, age } = req.body;
  await User.findByIdAndUpdate(data.id, { avatar, bio, age });
  res.json({ success: true });
});

// الغرف
app.get('/init', async (req, res) => {
  const rooms = [ { name: 'عام اليمن', type: 'عام' }, { name: 'صنعاء', type: 'محافظات' }, { name: 'عدن', type: 'محافظات' }, { name: 'تعز', type: 'محافظات' }, { name: 'VIP', type: 'خاص' } ];
  await Room.deleteMany({}); await Room.insertMany(rooms);
  res.send('تم انشاء الغرف');
});
app.get('/api/rooms', async (req, res) => { res.json(await Room.find({}).lean()); });
app.get('/api/messages/:room', async (req, res) => {
  res.json(await Message.find({ room: req.params.room }).limit(50).sort({ time: -1 }).lean().then(r=>r.reverse()));
});

// لوحة تحكم
const auth = (rank) => (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const data = jwt.verify(token, JWT_SECRET);
    if (!hasPermission(data.rank, rank)) return res.status(403).json({ error: 'ممنوع' });
    req.user = data; next();
  } catch { res.status(401).json({ error: 'غير مصرح' }); }
};

app.post('/api/admin/setRank', auth('مالك'), async (req, res) => {
  await User.updateOne({ name: req.body.name }, { rank: req.body.rank });
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
  await Room.create({ name: req.body.name, type: req.body.type || 'عام' });
  res.json({ success: true });
});

// ===== Socket.IO محسن للضغط =====
const onlineUsers = new Map(); // اسرع من Object
const roomsCache = new Map(); // كاش المستخدمين لكل غرفة

io.on('connection', (socket) => {
  socket.on('join', async (data) => {
    let user;
    if(data.rank === 'زائر'){
      user = { _id: socket.id, name: data.name || 'زائر'+Math.floor(Math.random()*10000), rank: 'زائر', gender: data.gender, age: data.age };
    } else {
      user = await User.findById(data.userId).lean();
      if (!user || user.isBanned) return socket.emit('error', 'محظور');
    }

    onlineUsers.set(socket.id, { id: user._id, name: user.name, rank: user.rank, room: data.room, gender: user.gender, age: user.age });

    if(!roomsCache.has(data.room)) roomsCache.set(data.room, new Set());
    roomsCache.get(data.room).add(socket.id);

    socket.join(data.room);
    socket.to(data.room).emit('system', `${user.name} [${user.rank}] دخل`);
    io.to(data.room).emit('users', getRoomUsers(data.room));
  });

  socket.on('chatMessage', async (data) => {
    const user = onlineUsers.get(socket.id); if (!user ||!data.msg) return;
    const msgData = { name: user.name, rank: user.rank, gender: user.gender, age: user.age, msg: data.msg, time: new Date() };
    if(user.rank!== 'زائر'){
      Message.create({ room: user.room, userId: user.id,...msgData }).catch(()=>{});
    }
    socket.to(user.room).emit('message', msgData); // to بدل io.to اسرع وما يرسل لنفسه
    socket.emit('message', msgData);
  });

  socket.on('mute', (data) => {
    const admin = onlineUsers.get(socket.id); if (!admin ||!hasPermission(admin.rank, 'مشرف')) return;
    io.to(data.targetId).emit('muted', data.time);
  });

  socket.on('kick', (data) => {
    const admin = onlineUsers.get(socket.id); if (!admin ||!hasPermission(admin.rank, 'اداري')) return;
    io.sockets.sockets.get(data.targetId)?.disconnect(true);
  });

  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      roomsCache.get(user.room)?.delete(socket.id);
      socket.to(user.room).emit('system', `${user.name} خرج`);
      io.to(user.room).emit('users', getRoomUsers(user.room));
      onlineUsers.delete(socket.id);
    }
  });
});

function getRoomUsers(room){
  const set = roomsCache.get(room); if(!set) return [];
  return Array.from(set).map(id => onlineUsers.get(id)).filter(Boolean);
}

server.listen(PORT, () => console.log(`Server ON on port ${PORT}`));