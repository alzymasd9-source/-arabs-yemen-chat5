const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { maxHttpBufferSize: 5e7, cors: { origin: "*" } });
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatDBFinal')
.then(() => console.log('✅ متصل بقاعدة البيانات'))
.catch(err => console.error('❌ خطأ في قاعدة البيانات:', err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));
app.use(session({ secret: 'SuperSecretChatKeyYemen2026', resave: false, saveUninitialized: true }));

// جدول المستخدمين
const userSchema = new mongoose.Schema({
username: { type: String, unique: true, required: true },
password: { type: String, required: true },
email: { type: String, required: true },
role: { type: String, default: 'member' },
isBanned: { type: Boolean, default: false },
isMuted: { type: Boolean, default: false },
points: { type: Number, default: 100 }
});
const User = mongoose.model('User', userSchema);

// جدول الرسائل
const messageSchema = new mongoose.Schema({
room: String, user: String, role: String, text: String,
type: { type: String, default: 'text' },
timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// تسجيل عضوية - أول واحد يصير مالك
app.post('/api/register', async (req, res) => {
try {
const { username, password, email } = req.body;
const userExists = await User.findOne({ username });
if (userExists) return res.status(400).json({ error: 'الاسم مسجل مسبقاً!' });

const hashedPassword = await bcrypt.hash(password, 10);
const totalUsers = await User.countDocuments({});
const assignedRole = totalUsers === 0? 'owner' : 'member';

const newUser = new User({ username, password: hashedPassword, email, role: assignedRole });
await newUser.save();
res.json({ success: `تم التسجيل! رتبتك: ${assignedRole === 'owner'? 'المالك 👑' : 'عضو'}` });
} catch (err) {
res.status(500).json({ error: 'خطأ في السيرفر' });
}
});

// تسجيل دخول
app.post('/api/login', async (req, res) => {
try {
const { username, password } = req.body;
const user = await User.findOne({ username });
if (!user) return res.status(400).json({ error: 'بيانات غلط!' });
if (user.isBanned) return res.status(403).json({ error: 'محظور نهائياً!' });

const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(400).json({ error: 'بيانات غلط!' });

req.session.user = { id: user._id, name: user.username, role: user.role };
res.json({ success: true, user: req.session.user });
} catch (err) {
res.status(500).json({ error: 'خطأ في السيرفر' });
}
});

// المتواجدين
let activeUsers = {};

io.on('connection', (socket) => {

socket.on('join room', async ({ roomName, user, role }) => {
if (socket.currentRoom) {
socket.leave(socket.currentRoom);
io.to(socket.currentRoom).emit('sys message', { text: `🚪 غادر: ${socket.username}` });
activeUsers[socket.currentRoom] = activeUsers[socket.currentRoom].filter(u => u.id!== socket.id);
io.to(socket.currentRoom).emit('update users', activeUsers[socket.currentRoom]);
}

socket.join(roomName);
socket.currentRoom = roomName;
socket.username = user;
socket.role = role;

io.to(roomName).emit('sys message', { text: `✨ انضم: ${user} [${role}]` });

if (!activeUsers[roomName]) activeUsers[roomName] = [];
activeUsers[roomName].push({ id: socket.id, name: user, role: role });

const roleOrder = { owner: 1, admin: 2, management: 3, moderator: 4, member: 5, guest: 6 };
activeUsers[roomName].sort((a, b) => (roleOrder[a.role] || 7) - (roleOrder[b.role] || 7));

io.to(roomName).emit('update users', activeUsers[roomName]);

const oldMsgs = await Message.find({ room: roomName }).sort({ timestamp: -1 }).limit(40);
socket.emit('load old messages', oldMsgs.reverse());
});

socket.on('chat message', async (data) => {
const userCheck = await User.findOne({ username: socket.username });
if(userCheck && userCheck.isMuted) {
return socket.emit('sys message', { text: '⚠️ أنت مكتوم' });
}

const newMsg = new Message({
room: socket.currentRoom, user: data.user, role: data.role, text: data.text
});
await newMsg.save();
io.to(socket.currentRoom).emit('chat message', newMsg);
});

socket.on('disconnect', () => {
if (socket.currentRoom && activeUsers[socket.currentRoom]) {
io.to(socket.currentRoom).emit('sys message', { text: `🚪 غادر: ${socket.username}` });
activeUsers[socket.currentRoom] = activeUsers[socket.currentRoom].filter(u => u.id!== socket.id);
io.to(socket.currentRoom).emit('update users', activeUsers[socket.currentRoom]);
}
});
});

// إرسال صفحة الدخول - هذا أهم سطر
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'index.html'))
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 السيرفر جاهز على المنفذ: ${PORT}`));
