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
const DATA_DIR = './data'; if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const BANS_FILE = path.join(DATA_DIR, 'bans.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const MUTED_FILE = path.join(DATA_DIR, 'muted.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MAX_MESSAGES = 100;

const loadJSON = (file, d = {}) => fs.existsSync(file)? JSON.parse(fs.readFileSync(file, 'utf8')) : d;
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

let bannedIPs = loadJSON(BANS_FILE);
let chatHistory = loadJSON(MESSAGES_FILE, { 'عام': [], 'اليمن': [], 'الجزائر': [], 'مصر': [] });
let globalMuted = loadJSON(MUTED_FILE, []);
let registeredUsers = loadJSON(USERS_FILE, {});

let users = {};
let rooms = { 'عام': [], 'اليمن': [], 'الجزائر': [], 'مصر': [] };
const ADMINS = ['admin', 'مدير'];
const VIP_PRICE = 500;
const MSG_CREDITS = 1;

const saveBans = () => saveJSON(BANS_FILE, bannedIPs);
const saveMuted = () => saveJSON(MUTED_FILE, globalMuted);
const saveUsers = () => saveJSON(USERS_FILE, registeredUsers);
const saveMessage = (room, msg) => {
  if(!chatHistory) chatHistory = [];
  chatHistory.push(msg);
  if (chatHistory.length > MAX_MESSAGES) chatHistory.shift();
  saveJSON(MESSAGES_FILE, chatHistory);
};

const imgStorage = multer.diskStorage({ destination: './uploads/', filename: (req, f, cb) => cb(null, 'img_' + Date.now() + path.extname(f.originalname)) });
const audioStorage = multer.diskStorage({ destination: './uploads/', filename: (req, f, cb) => cb(null, 'audio_' + Date.now() + '.webm') });
app.post('/upload', multer({ storage: imgStorage }).single('image'), (req, res) => res.json({ url: '/uploads/' + req.file.filename }));
app.post('/upload-audio', multer({ storage: audioStorage }).single('audio'), (req, res) => res.json({ url: '/uploads/' + req.file.filename }));

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
  if (bannedIPs[ip] && (bannedIPs[ip].expire === null || bannedIPs[ip].expire > Date.now())) {
    return socket.emit('banned', `انت محظور: ${bannedIPs[ip].reason}`) && socket.disconnect(true);
  } else if (bannedIPs[ip]) { delete bannedIPs[ip]; saveBans(); }

  socket.on('register', (data, cb) => {
    if(registeredUsers[data.name]) return cb({ok:false, msg:'الاسم مستخدم'});
    registeredUsers[data.name] = {pass:data.pass, email:data.email, gender:data.gender, age:data.age, credits:100, vipExpire:0};
    saveUsers();
    cb({ok:true});
  });

  socket.on('login', (data, cb) => {
    const u = registeredUsers[data.name];
    if(!u || u.pass!== data.pass) return cb({ok:false, msg:'خطأ في البيانات'});
    joinUser(socket, {name:data.name, gender:u.gender, age:u.age, credits:u.credits, vipExpire:u.vipExpire}, ip, cb);
  });

  socket.on('joinGuest', (data, cb) => {
    joinUser(socket, {...data, credits:0, vipExpire:0}, ip, cb);
  });

  function joinUser(socket, data, ip, cb){
    const isAdmin = ADMINS.includes(data.name.toLowerCase());
    const isVip = data.vipExpire > Date.now();
    users[socket.id] = {...data, id:socket.id, room:'عام', isAdmin, ip, isVip};
    socket.join('عام'); rooms['عام'].push(socket.id);
    io.to('عام').emit('user joined', users[socket.id]);
    socket.emit('you are', {...users[socket.id], chatHistory: chatHistory['عام'] || []});
    cb({ok:true, user:users[socket.id]});
  }

  socket.on('joinRoom', (r) => {
    const user = users[socket.id]; if (!user) return;
    socket.leave(user.room); rooms[user.room] = rooms[user.room].filter(id => id!== socket.id);
    io.to(user.room).emit('user left', user.name);
    user.room = r; socket.join(r); rooms[r].push(socket.id);
    io.to(r).emit('user joined', user);
    socket.emit('chat history', chatHistory[r] || []);
  });

  socket.on('message', (d) => {
    const user = users[socket.id]; if (!user || globalMuted.includes(socket.id)) return;
    if(user.credits!== undefined &&!user.isAdmin && d.type==='text'){
      user.credits += MSG_CREDITS;
      if(registeredUsers[user.name]){ registeredUsers[user.name].credits = user.credits; saveUsers(); }
      socket.emit('credits update', user.credits);
    }
    const msg = {id: Date.now(), type: d.type || 'text', content: d.content, user: {name: user.name, gender: user.gender, id: user.id, age:user.age, isVip:user.isVip, isAdmin:user.isAdmin}, time: new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})};
    saveMessage(user.room, msg); io.to(user.room).emit('message', msg);
  });

  socket.on('buy vip', () => {
    const user = users[socket.id]; if(!user || user.credits < VIP_PRICE) return socket.emit('system','رصيدك لا يكفي');
    user.credits -= VIP_PRICE;
    user.isVip = true;
    user.vipExpire = Date.now() + 30*24*3600*1000;
    if(registeredUsers[user.name]){ registeredUsers[user.name].credits=user.credits; registeredUsers[user.name].vipExpire=user.vipExpire; saveUsers(); }
    socket.emit('vip bought', {credits:user.credits, expire:user.vipExpire});
    io.to(user.room).emit('system', `💎 ${user.name} اشترى العضوية المميزة`);
  });

  socket.on('get store', () => { socket.emit('store data', {credits:users[socket.id]?.credits||0, vipPrice:VIP_PRICE}); });
  socket.on('get users', () => { socket.emit('users list', Object.values(users)); });

  socket.on('mute user', (id) => { if(users[socket.id]?.isAdmin &&!globalMuted.includes(id)){ globalMuted.push(id); saveMuted(); io.to(id).emit('you muted', true); } });
  socket.on('unmute user', (id) => { if(users[socket.id]?.isAdmin){ globalMuted = globalMuted.filter(x => x!== id); saveMuted(); io.to(id).emit('you muted', false); } });
  socket.on('kick user', (id) => { if(users[socket.id]?.isAdmin){ io.to(id).emit('kicked', 'تم طردك'); io.sockets.sockets.get(id)?.disconnect(true); } });
  socket.on('ban user', (d) => {
    if(!users[socket.id]?.isAdmin) return;
    const t = users[d.targetId]; if(!t) return;
    bannedIPs[t.ip] = {reason: d.reason||'مخالفة', expire: d.hours? Date.now()+d.hours*3600000:null, by: users[socket.id].name};
    saveBans();
    io.to(d.targetId).emit('banned', `تم حظرك: ${bannedIPs[t.ip].reason}`);
    io.sockets.sockets.get(d.targetId)?.disconnect(true);
  });
  socket.on('get bans', () => { if(users[socket.id]?.isAdmin) socket.emit('bans list', bannedIPs); });

  socket.on('disconnect', () => { const u=users[socket.id]; if(u){ rooms[u.room]=rooms[u.room].filter(x=>x!==socket.id); io.to(u.room).emit('user left', u.name); delete users[socket.id]; } });
});

setInterval(()=>{ saveBans(); saveJSON(MESSAGES_FILE, chatHistory); saveMuted(); }, 30000);
const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`شغال على http://localhost:${PORT}`));