const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/yemenchat');

const Room = mongoose.model('Room', { name: String });
const Message = mongoose.model('Message', { roomId: String, user: Object, text: String, time: Date });

io.on('connection', (socket) => {
  let myUserData = {};

  socket.on('join', async (data) => {
    myUserData = data;
    socket.emit('rooms', await Room.find());
  });

  socket.on('joinRoom', async (roomId) => {
    socket.join(roomId);
    const msgs = await Message.find({roomId}).sort({time: 1}).limit(50);
    socket.emit('oldMessages', msgs);
    io.to(roomId).emit('users', [{...myUserData, socketId: socket.id}]);
  });

  socket.on('sendMessage', async ({roomId, text, user}) => {
    const msg = new Message({roomId, user, text, time: new Date()});
    await msg.save();
    io.to(roomId).emit('message', msg);
  });
});

app.get('/init', async (req,res) => {
  if(await Room.countDocuments() === 0){
    await Room.insertMany([{name:'عام'}, {name:'تعارف'}, {name:'وناسة'}]);
  }
  res.send('تم انشاء الغرف');
});

server.listen(process.env.PORT || 3000, () => console.log('Server ON'));

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== قاعدة البيانات =====
mongoose.connect(MONGO_URL, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const MessageSchema = new mongoose.Schema({
  room: String,
  name: String,
  gender: String,
  age: Number,
  msg: String,
  time: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', MessageSchema);

const RoomSchema = new mongoose.Schema({
  name: String,
  type: String // عام، خاص
});
const Room = mongoose.model('Room', RoomSchema);

// ===== انشاء الغرف الافتراضية =====
app.get('/init', async (req, res) => {
  const rooms = [
    { name: 'عام اليمن', type: 'عام' },
    { name: 'صنعاء', type: 'محافظات' },
    { name: 'عدن', type: 'محافظات' },
    { name: 'تعز', type: 'محافظات' },
    { name: 'حضرموت', type: 'محافظات' }
  ];
  await Room.deleteMany({});
  await Room.insertMany(rooms);
  res.send('تم انشاء الغرف');
});

// ===== API لجلب الغرف =====
app.get('/api/rooms', async (req, res) => {
  const rooms = await Room.find({});
  res.json(rooms);
});

// ===== API لجلب الرسائل =====
app.get('/api/messages/:room', async (req, res) => {
  const messages = await Message.find({ room: req.params.room }).limit(50).sort({ time: -1 });
  res.json(messages.reverse());
});

// ===== Socket.IO =====
const users = {}; // { socketId: {name, gender, age, room} }

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async (data) => {
    const { name, gender, age, room } = data;
    users[socket.id] = { name, gender, age, room };
    socket.join(room);
    
    // اشعار دخول
    io.to(room).emit('system', `${name} دخل الغرفة`);
    
    // تحديث عدد المتصلين
    const count = io.sockets.adapter.rooms.get(room)?.size || 0;
    io.to(room).emit('usersCount', count);
  });

  socket.on('chatMessage', async (data) => {
    const user = users[socket.id];
    if (!user) return;

    const newMsg = new Message({
      room: user.room,
      name: user.name,
      gender: user.gender,
      age: user.age,
      msg: data.msg
    });
    await newMsg.save();

    io.to(user.room).emit('message', {
      name: user.name,
      gender: user.gender,
      age: user.age,
      msg: data.msg,
      time: new Date()
    });
  });

  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      io.to(user.room).emit('system', `${user.name} خرج من الغرفة`);
      const count = io.sockets.adapter.rooms.get(user.room)?.size || 0;
      io.to(user.room).emit('usersCount', count);
      delete users[socket.id];
    }
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server ON on port ${PORT}`);
});