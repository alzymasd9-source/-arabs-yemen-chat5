const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static('.'));

const AVATARS = {
  'زائر-ذكر': 'https://i.pravatar.cc/45?u=guestm',
  'زائر-انثى': 'https://i.pravatar.cc/45?u=guestf',
  'عضو-ذكر': 'https://i.pravatar.cc/45?u=memberm',
  'عضو-انثى': 'https://i.pravatar.cc/45?u=memberf',
  'مميز-ذكر': 'https://i.pravatar.cc/45?u=vvipm',
  'مميز-انثى': 'https://i.pravatar.cc/45?u=vvipf'
};

let usersDB = {};
let onlineUsers = {};

function loadDB() {
  try {
    usersDB = JSON.parse(fs.readFileSync('users.json', 'utf8'));
  } catch(e) {
    usersDB = {};
    fs.writeFileSync('users.json', JSON.stringify(usersDB, null, 2));
  }
}

function saveDB() {
  fs.writeFileSync('users.json', JSON.stringify(usersDB, null, 2));
}

loadDB();

io.on('connection', (socket) => {
  console.log('مستخدم اتصل');

  socket.on('join', (data) => {
    let name = data.name || 'زائر';
    let pass = data.password || '';
    let rank = usersDB[name]?.rank || 'زائر';
    let gender = usersDB[name]?.gender || data.gender || 'ذكر';

    // دخول الأعضاء
    if(data.from === 'member') {
      if(!usersDB[name]) {
        socket.emit('error', 'الاسم غير مسجل');
        return;
      }
      if(usersDB[name].password !== pass) {
        socket.emit('error', 'كلمة المرور خطأ');
        return;
      }
      rank = usersDB[name].rank;
      gender = usersDB[name].gender;
    }

    // زائر جديد
    if(!usersDB[name] && rank === 'زائر') {
      usersDB[name] = {rank, gender, password: '', avatar: null, balance: 0};
      saveDB();
    } else if(rank !== 'زائر') {
      gender = usersDB[name].gender;
    }

    let avatarKey = `${rank}-${gender}`;
    let avatar = (rank === 'مميز') ? usersDB[name].avatar : AVATARS[avatarKey];
    if(!avatar) avatar = AVATARS['زائر-ذكر'];

    onlineUsers[socket.id] = {name, rank, gender, avatar};

    io.emit('system', {text: `${name} انضم [${rank}]`});
    socket.emit('myData', onlineUsers[socket.id]);
  });

  socket.on('chat message', (msg) => {
    let user = onlineUsers[socket.id];
    if(user) {
      io.emit('chat message', {
        name: user.name,
        rank: user.rank,
        gender: user.gender,
        avatar: user.avatar,
        text: msg.text,
        time: msg.time
      });
    }
  });

  socket.on('sendMedia', (data) => {
    let user = onlineUsers[socket.id];
    if(user && ['مميز','مشرف','ادارة','ادمن','مالك'].includes(user.rank)) {
      io.emit('newMedia', {
        name: user.name,
        rank: user.rank,
        gender: user.gender,
        avatar: user.avatar,
        type: data.type,
        url: data.url,
        time: data.time
      });
    } else {
      socket.emit('error', 'هذي الميزة للمميز فقط');
    }
  });

  socket.on('disconnect', () => {
    let user = onlineUsers[socket.id];
    if(user) {
      io.emit('system', {text: `${user.name} غادر`});
      delete onlineUsers[socket.id];
    }
  });
});

http.listen(3000, () => console.log('السيرفر شغال على 3000'));
