const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));
app.use(express.json());

// صور الرتب الثابتة
const AVATARS = {
  زائر: 'https://i.imgur.com/8Km9tLL.png', // رقم 1 وردي
  عضو: 'https://i.imgur.com/lr8uK9B.png' // رقم 2 أزرق
};

const DB_FILE = path.join(__dirname, 'users.json');
let usersDB = {}; // {اسم: {rank, avatar, balance}}
let onlineUsers = {}; // {socketId: {name, rank, avatar}}

// تحميل الداتا بيز
if(fs.existsSync(DB_FILE)){
  usersDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(){
  fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
}

// هل الرتبة تقدر ترسل ميديا؟
function canSendMedia(rank) {
  return ['مميز','مشرف','ادارة','ادمن','مالك'].includes(rank);
}

io.on('connection', (socket) => {

  socket.on('join', (data) => {
    let name = data.name || 'زائر';
    let rank = usersDB[name]?.rank || data.rank || 'زائر';

    if(!usersDB[name]) {
      usersDB[name] = {rank, avatar: AVATARS, balance: 0};
      saveDB();
    }

    let avatar = (rank === 'مميز')? usersDB[name].avatar : AVATARS;
    onlineUsers[socket.id] = {name, rank, avatar};

    socket.broadcast.emit('chat message', {name: 'النظام', text: `${name} انضم [${rank}]`});
    socket.emit('myData', onlineUsers[socket.id]);
  });

  // رسائل نصية عادية
  socket.on('chat message', (data) => {
    let user = onlineUsers[socket.id];
    if(!user) return;

    let avatarToShow = (user.rank === 'مميز')? user.avatar : AVATARS[user.rank];

    io.emit('chat message', {
      name: user.name,
      rank: user.rank,
      avatar: avatarToShow,
      text: data.text,
      time: data.time
    });
  });

  // ========== منع الصور واليوتيوب للزائر والعضو ==========
  socket.on('sendMedia', (data) => {
    let user = onlineUsers[socket.id];
    if(!user) return;

    if(!canSendMedia(user.rank)) {
      socket.emit('error', 'ممنوع: رفع الصور واليوتيوب للمميز فقط 💎');
      return;
    }

    if(data.type === 'image' && data.url.startsWith('http')) {
      io.emit('newMedia', {
        type: 'image',
        url: data.url,
        name: user.name,
        rank: user.rank,
        avatar: user.avatar,
        time: data.time
      });
    }

    if(data.type === 'youtube' && (data.url.includes('youtube.com') || data.url.includes('youtu.be'))) {
      io.emit('newMedia', {
        type: 'youtube',
        url: data.url,
        name: user.name,
        rank: user.rank,
        avatar: user.avatar,
        time: data.time
      });
    }
  });

  // تغيير الصورة - بس للمميز
  socket.on('changeAvatar', (newAvatar) => {
    let user = onlineUsers[socket.id];
    if(!user) return;

    if(user.rank!== 'مميز') {
      socket.emit('error', 'لازم تكون مميز عشان تغير الصورة');
      return;
    }
    if(!newAvatar.startsWith('http')) {
      socket.emit('error', 'رابط الصورة غير صالح');
      return;
    }

    user.avatar = newAvatar;
    usersDB[user.name].avatar = newAvatar;
    saveDB();
    socket.emit('avatarUpdated', newAvatar);
  });

  socket.on('disconnect', () => {
    let user = onlineUsers[socket.id];
    if(user){
      socket.broadcast.emit('chat message', {name: 'النظام', text: `${user.name} غادر`});
      delete onlineUsers[socket.id];
    }
  });
});

http.listen(3000, () => console.log('السيرفر شغال على http://localhost:3000'));
