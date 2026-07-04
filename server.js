const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// اهم شي حق Render: السماح باي origin + websocket
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
const DATA_DIR = './data'; if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const BANS_FILE = path.join(DATA_DIR, 'bans.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const MUTED_FILE = path.join(DATA_DIR, 'muted.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const loadJSON = (file, d = {}) => fs.existsSync(file)? JSON.parse(fs.readFileSync(file, 'utf8')) : d;
const saveJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');

let bannedIPs = loadJSON(BANS_FILE);
let chatHistory = loadJSON(MESSAGES_FILE, []);
let globalMuted = loadJSON(MUTED_FILE, []);
let registeredUsers = loadJSON(USERS_FILE, {});

let users = {};
const ADMINS = ['admin', 'مدير'];

const saveUsers = () => saveJSON(USERS_FILE, registeredUsers);

const imgStorage = multer.diskStorage({ destination: './uploads/', filename: (req, f, cb) => cb(null, 'img_' + Date.now() + path.extname(f.originalname)) });
app.post('/upload', multer({ storage: imgStorage }).single('image'), (req, res) => res.json({ url: '/uploads/' + req.file.filename }));

io.on('connection', (socket) => {
  console.log('connected:', socket.id);
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
  if (bannedIPs[ip] && (bannedIPs[ip].expire === null || bannedIPs[ip].expire > Date.now())) {
    return socket.emit('banned', `انت محظور`) && socket.disconnect(true);
  }

  socket.on('register', (data, cb) => {
    if(registeredUsers[data.name]) return cb({ok:false, msg:'الاسم مستخدم'});
    registeredUsers[data.name] = {pass:data.pass, email:data.email, credits:100, vipExpire:0};
    saveUsers(); cb({ok:true});
  });

  socket.on('login', (data, cb) => {
    const u = registeredUsers[data.name];
    if(!u || u.pass!== data.pass) return cb({ok:false, msg:'خطأ في البيانات'});
    joinUser(socket, {name:data.name, credits:u.credits, vipExpire:u.vipExpire}, cb);
  });

  socket.on('joinGuest', (data, cb) => {
    joinUser(socket, {...data, credits:0, vipExpire:0}, cb);
  });

  function joinUser(socket, data, cb){
    const isAdmin = ADMINS.includes(data.name.toLowerCase());
    const isVip = data.vipExpire > Date.now();
    users[socket.id] = {...data, id:socket.id, isAdmin, ip, isVip};
    io.emit('user joined', users[socket.id]);
    socket.emit('you are', {...users[socket.id], chatHistory: chatHistory.slice(-50)});
    cb({ok:true, user:users[socket.id]});
  }

  socket.on('message', (d) => {
    const user = users[socket.id]; if (!user || globalMuted.includes(socket.id)) return;
    const msg = {id: Date.now(), type: d.type || 'text', content: d.content, user: {name: user.name, id: user.id, isVip:user.isVip, isAdmin:user.isAdmin}, time: new Date().toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})+' 16/05'};
    chatHistory.push(msg);
    if (chatHistory.length > 100) chatHistory.shift();
    saveJSON(MESSAGES_FILE, chatHistory);
    io.emit('message', msg);
  });

  socket.on('get users', () => { socket.emit('users list', Object.values(users)); });
  socket.on('disconnect', () => { const u=users[socket.id]; if(u){ io.emit('user left', u.name); delete users[socket.id]; } });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`شغال على ${PORT}`));