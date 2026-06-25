const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });

app.use(express.static(__dirname));
app.use(express.json());

// صور ثابتة حسب الرتبة + الجنس
const AVATARS = {
  'زائر-ذكر': 'https://api.dicebear.com/7.x/personas/svg?seed=male&backgroundColor=00aaff',
  'زائر-انثى': 'https://api.dicebear.com/7.x/personas/svg?seed=female&backgroundColor=ff66cc',
  'زائر-جنس3': 'https://api.dicebear.com/7.x/personas/svg?seed=neutral&backgroundColor=ffffff',

  'عضو-ذكر': 'https://api.dicebear.com/7.x/personas/svg?seed=male2&backgroundColor=0088ff',
  'عضو-انثى': 'https://api.dicebear.com/7.x/personas/svg?seed=female2&backgroundColor=ff4499',
  'عضو-جنس3': 'https://api.dicebear.com/7.x/personas/svg?seed=neutral2&backgroundColor=eeeeee'
};

const DB_FILE = path.join(__dirname, 'users.json');
let usersDB = {};
let onlineUsers = {};

if(fs.existsSync(DB_FILE)){
  usersDB = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(){
  fs.writeFileSync(DB_FILE, JSON.stringify(usersDB, null, 2));
}

function canSendMedia(rank) {
  return ['مميز','مشرف','ادارة','ادمن','مالك'].includes(rank);
}

io.on('connection', (socket) => {

  socket.on('join', (data) => {
    let name = data.name || 'زائر';
    let rank = usersDB[name]?.rank || data.rank || 'زائر';
    let gender = usersDB[name]?.gender || data.gender || 'ذكر'; // ذكر / انثى / جنس3

    if(!usersDB[name]) {
      usersDB[name] = {rank, gender, avatar: null, balance: 0};
      saveDB();
    }

    let avatarKey = `${rank}-${gender}`;
    let avatar = (rank === 'مميز')? usersDB[name].avatar : AVATARS[avatarKey];
    if(!avatar) avatar = AVATARS['زائر-ذكر']; // احتياط

    onlineUsers[socket.id] = {name, rank, gender, avatar};

    socket.broadcast.emit('chat message', {name: 'النظام', text: `${name} انضم [${rank}]`});
    socket.emit('myData', onlineUsers[socket.id]);
  });

  socket.on('chat message', (data) => {
    let user = onlineUsers[socket.id];
    if(!user) return;

    let avatarKey = `${user.rank}-${user.gender}`;
    let avatarToShow = (user.rank === 'مميز')? user.avatar : AVATARS[avatarKey];

    io.emit('chat message', {
      name: user.name,
      rank: user.rank,
      gender: user.gender,
      avatar: avatarToShow,
      text: data.text,
      time: data.time
    });
  });

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
        gender: user.gender,
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
        gender: user.gender,
        avatar: user.avatar,
        time: data.time
      });
    }
  });

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
