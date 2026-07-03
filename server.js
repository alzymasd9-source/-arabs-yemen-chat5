const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');

// ========== رفع الصور + الصوت ==========
const imgStorage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, 'img_' + Date.now() + path.extname(file.originalname))
});
const audioStorage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => cb(null, 'audio_' + Date.now() + '.webm')
});
const uploadImg = multer({ storage: imgStorage }).single('image');
const uploadAudio = multer({ storage: audioStorage }).single('audio');

app.post('/upload', (req, res) => uploadImg(req, res, err => err? res.status(500).json({ error: err }) : res.json({ url: '/uploads/' + req.file.filename })));
app.post('/upload-audio', (req, res) => uploadAudio(req, res, err => err? res.status(500).json({ error: err }) : res.json({ url: '/uploads/' + req.file.filename })));

// ========== بيانات الشات ==========
let users = {}; // { socketId: {id, name, gender, room, isAdmin, mutedBy: []} }
let rooms = { 'عام': [], 'تعارف': [], 'اليمن': [], 'فلة': [] };
let globalMuted = []; // ميووت عام من المشرف [socketId, socketId]

const ADMINS = ['admin', 'مدير']; // اي اسم مستخدم يكون مشرف تلقائي

// ========== Socket.io ==========
io.on('connection', (socket) => {
  console.log('متصل جديد:', socket.id);

  // 1. دخول مستخدم جديد
  socket.on('join', (userData) => {
    const isAdmin = ADMINS.includes(userData.name.toLowerCase());
    users[socket.id] = {...userData, id: socket.id, room: 'عام', isAdmin, mutedBy: [] };
    socket.join('عام');
    rooms['عام'].push(socket.id);

    io.to('عام').emit('user joined', users[socket.id]);
    socket.emit('users list', getUsersInRoom('عام'));
    socket.emit('you are', {id: socket.id, isAdmin}); // بلغك انت من انت
  });

  // 2. تبديل غرفة
  socket.on('joinRoom', (newRoom) => {
    const user = users[socket.id]; if (!user) return;
    socket.leave(user.room); rooms[user.room] = rooms[user.room].filter(id => id!== socket.id);
    io.to(user.room).emit('user left', user.name);
    user.room = newRoom; socket.join(newRoom); rooms[newRoom].push(socket.id);
    io.to(newRoom).emit('user joined', user);
    socket.emit('users list', getUsersInRoom(newRoom));
  });

  // 3. رسالة عامة أو صورة أو صوت
  socket.on('message', (data) => {
    const user = users[socket.id];
    if (!user || globalMuted.includes(socket.id)) return; // مكتوم عام

    const msgData = {
      type: data.type, // text, img, audio
      content: data.content,
      user: { name: user.name, gender: user.gender, id: user.id },
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    if (data.pm) {
      const targetSocket = io.sockets.sockets.get(data.pm);
      if (targetSocket &&!users[data.pm].mutedBy.includes(socket.id)) { // لو الطرف الثاني ما كتمك
        targetSocket.emit('pm message', msgData);
        socket.emit('pm message', msgData);
      }
    } else {
      io.to(user.room).emit('message', msgData);
    }
  });

  // 4. ميووت من مشرف [جديد]
  socket.on('mute user', (targetId) => {
    const admin = users[socket.id];
    if (!admin?.isAdmin) return;
    if (!globalMuted.includes(targetId)) {
      globalMuted.push(targetId);
      io.to(targetId).emit('you muted', true);
      io.to(admin.room).emit('system', `${users[targetId].name} تم كتمه بواسطة ${admin.name}`);
    }
  });

  // 5. فك ميووت من مشرف [جديد]
  socket.on('unmute user', (targetId) => {
    const admin = users[socket.id];
    if (!admin?.isAdmin) return;
    globalMuted = globalMuted.filter(id => id!== targetId);
    io.to(targetId).emit('you muted', false);
    io.to(admin.room).emit('system', `${users[targetId].name} تم فك الكتم عنه`);
  });

  // 6. طرد من مشرف [جديد]
  socket.on('kick user', (targetId) => {
    const admin = users[socket.id];
    if (!admin?.isAdmin) return;
    io.to(targetId).emit('kicked', 'تم طردك من الشات بواسطة المشرف');
    io.sockets.sockets.get(targetId)?.disconnect(true);
  });

  // 7. حفظ إعدادات الخط واللون [جديد]
  socket.on('save settings', (settings) => {
    const user = users[socket.id]; if (!user) return;
    user.font = settings.font;
    user.color = settings.color;
    // لو عندك MySQL احفظها هنا
  });

  // 8. قطع الاتصال
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      rooms[user.room] = rooms[user.room].filter(id => id!== socket.id);
      globalMuted = globalMuted.filter(id => id!== socket.id);
      io.to(user.room).emit('user left', user.name);
      delete users[socket.id];
    }
  });

});

function getUsersInRoom(roomName) {
  return rooms[roomName].map(id => users[id]).filter(Boolean);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر شغال على http://localhost:${PORT}`));