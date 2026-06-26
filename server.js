const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

app.use(express.static('public'));
app.use(express.json());

let usersDB = {};
let onlineUsers = {};
let mutedUsers = {};
let userLogs = {};
let rooms = {"اللبي": []};

const USERS_FILE = 'users.json';
const LOGS_FILE = 'logs.json';

if(fs.existsSync(USERS_FILE)) usersDB = JSON.parse(fs.readFileSync(USERS_FILE));
if(fs.existsSync(LOGS_FILE)) userLogs = JSON.parse(fs.readFileSync(LOGS_FILE));

function saveUsers(){ fs.writeFileSync(USERS_FILE, JSON.stringify(usersDB, null, 2)); }
function saveLogs(){ fs.writeFileSync(LOGS_FILE, JSON.stringify(userLogs, null, 2)); }

function hasPermission(rank, need){
  const order = {"زائر":1,"عضو":2,"مميز":3,"مشرف غرفة":4,"مسؤول غرفة":5,"مالك غرفة":6,"مشرف":7,"ادارة":8,"ادمن":9,"مالك":10};
  return order[rank] >= order[need];
}

function canModerate(adminRank, targetRank){
  const order = {"زائر":1,"عضو":2,"مميز":3,"مشرف غرفة":4,"مسؤول غرفة":5,"مالك غرفة":6,"مشرف":7,"ادارة":8,"ادمن":9,"مالك":10};
  return order[adminRank] > order[targetRank];
}

function addLog(target, action, by, byRank, minutes, reason){
  if(!userLogs[target]) userLogs[target] = [];
  userLogs[target].push({action, by, byRank, minutes, reason, time: Date.now()});
  saveLogs();
}

io.on('connection', (socket) => {
  socket.on('login', (data) => {
    let user = usersDB[data.name];

    if(!user){
      let isFirstUser = Object.keys(usersDB).length === 0;
      user = {
        name: data.name,
        password: data.password,
        rank: isFirstUser? "مالك" : "عضو",
        credits: 0,
        gender: data.gender,
        avatar: 'https://i.pravatar.cc/50',
        wall: '',
        status: 'خير جالس هنا',
        likedBy: [],
        friends: [],
        about: '',
        lang: 'العربية',
        theme: 'Dark',
        lastSeen: Date.now()
      };
      usersDB[data.name] = user;
      saveUsers();
      socket.emit('chat', {name:'النظام', text: isFirstUser? 'مبروك انت أول شخص وصارت رتبتك مالك 👑' : 'تم إنشاء حساب جديد', time:'الآن', color:'gold'});
    } else {
      if(user.password!== data.password){
        socket.emit('error', 'كلمة السر غلط');
        return;
      }
    }

    onlineUsers[socket.id] = {name: data.name, rank: user.rank, room: "اللبي"};
    rooms["اللبي"].push(socket.id);
    user.lastSeen = Date.now();

    socket.emit('loginSuccess', {name: data.name, rank: user.rank, credits: user.credits, avatar: user.avatar});
    io.emit('userList', Object.values(onlineUsers).map(u => ({name: u.name, rank: u.rank})));
  });

  socket.on('getUserBox', (name) => {
    let u = usersDB[name];
    socket.emit('userBoxData', {name: u.name, avatar: u.avatar, age: '--', gender: u.gender});
  });

  socket.on('getFullProfile', (name) => {
    let u = usersDB[name];
    let online = Object.values(onlineUsers).find(x => x.name === name);
    socket.emit('fullProfileData', {
      name: u.name, avatar: u.avatar, wall: u.wall, rank: u.rank, status: u.status,
      likes: u.likedBy.length, credits: u.credits, gender: u.gender, room: online?.room || 'غير متصل',
      about: u.about, friends: u.friends, lastSeen: u.lastSeen, lang: u.lang, theme: u.theme,
      ip: socket.handshake.address, location: 'اليمن'
    });
  });

  socket.on('mute', (data) => {
    let admin = onlineUsers[socket.id];
    if(!hasPermission(admin.rank, "مشرف غرفة")) return;
    let target = Object.values(onlineUsers).find(u => u.name === data.target);
    if(!target ||!canModerate(admin.rank, target.rank)) return;
    mutedUsers[data.target] = Date.now() + data.minutes * 60000;
    addLog(data.target, 'كتم', admin.name, admin.rank, data.minutes, data.reason);
    socket.emit('chat', {name:'النظام', text:`تم كتم ${data.target} ${data.minutes} دقيقة`, time:'الآن', color:'orange'});
  });

  socket.on('kick', (data) => {
    let admin = onlineUsers[socket.id];
    if(!hasPermission(admin.rank, "مسؤول غرفة")) return;
    let targetSocket = Object.keys(onlineUsers).find(id => onlineUsers[id].name === data.target);
    if(!targetSocket ||!canModerate(admin.rank, onlineUsers[targetSocket].rank)) return;
    addLog(data.target, 'طرد', admin.name, admin.rank, data.minutes, data.reason);
    io.to(targetSocket).emit('error', `تم طردك ${data.minutes} دقيقة`);
    io.sockets.sockets.get(targetSocket).disconnect();
  });

  socket.on('getUserLog', (name) => {
    let admin = onlineUsers[socket.id];
    if(!hasPermission(admin.rank, "ادارة")) return;
    socket.emit('userLogData', userLogs[name] || []);
  });

  socket.on('clearUserLog', (name) => {
    let admin = onlineUsers[socket.id];
    if(admin.rank!== "مالك") return;
    addLog(name, 'مسح السجل', admin.name, admin.rank, null, 'مسح بواسطة المالك');
    delete userLogs[name];
    saveLogs();
    socket.emit('logCleared', name);
  });

  socket.on('exportUserLog', (name) => {
    let admin = onlineUsers[socket.id];
    if(admin.rank!== "مالك") return;
    socket.emit('exportLogData', {name, logs: userLogs[name] || []});
    addLog(name, 'تصدير السجل', admin.name, admin.rank, null, 'تصدير PDF');
  });

  socket.on('likeUser', (name) => {
    let user = usersDB[name];
    let liker = onlineUsers[socket.id].name;
    if(!user.likedBy.includes(liker)){
      user.likedBy.push(liker);
      saveUsers();
      socket.emit('chat', {name:'النظام', text:`لايكت ${name}`, time:'الآن', color:'pink'});
    }
  });

  socket.on('disconnect', () => {
    delete onlineUsers[socket.id];
    io.emit('userList', Object.values(onlineUsers).map(u => ({name: u.name, rank: u.rank})));
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server on', PORT));
