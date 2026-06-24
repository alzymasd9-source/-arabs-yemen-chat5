const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatDBFinal')
.then(() => console.log('✅ متصل بقاعدة البيانات'))
.catch(err => console.error('❌ خطأ:', err));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname)));
app.use(session({ secret: 'SecretKey2026', resave: false, saveUninitialized: true }));

const userSchema = new mongoose.Schema({
username: { type: String, unique: true, required: true },
password: { type: String, required: true },
email: { type: String, required: true },
role: { type: String, default: 'member' },
isBanned: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const messageSchema = new mongoose.Schema({
room: String, user: String, role: String, text: String,
timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

app.post('/api/register', async (req, res) => {
try {
const { username, password, email } = req.body;
const userExists = await User.findOne({ username });
if (userExists) return res.status(400).json({ error: 'الاسم مسجل!' });
const hashedPassword = await bcrypt.hash(password, 10);
const totalUsers = await User.countDocuments({});
const assignedRole = totalUsers === 0? 'owner' : 'member';
const newUser = new User({ username, password: hashedPassword, email, role: assignedRole });
await newUser.save();
res.json({ success: `تم التسجيل! رتبتك: ${assignedRole === 'owner'? 'المالك 👑' : 'عضو'}` });
} catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

app.post('/api/login', async (req, res) => {
try {
const { username, password } = req.body;
const user = await User.findOne({ username });
if (!user) return res.status(400).json({ error: 'بيانات غلط!' });
if (user.isBanned) return res.status(403).json({ error: 'محظور!' });
const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) return res.status(400).json({ error: 'بيانات غلط!' });
req.session.user = { id: user._id, name: user.username, role: user.role };
res.json({ success: true, user: req.session.user });
} catch (err) { res.status(500).json({ error: 'خطأ' }); }
});

let activeUsers = {};
io.on('connection', (socket) => {
socket.on('join room', async ({ roomName, user, role }) => {
socket.join(roomName);
socket.currentRoom = roomName;
socket.username = user;
socket.role = role;
io.to(roomName).emit('sys message', { text: `✨ انضم: ${user} [${role}]` });
const oldMsgs = await Message.find({ room: roomName }).sort({ timestamp: -1 }).limit(40);
socket.emit('load old messages', oldMsgs.reverse());
});

socket.on('chat message', async (data) => {
const newMsg = new Message({room: socket.currentRoom, user: data.user, role: data.role, text: data.text});
await newMsg.save();
io.to(socket.currentRoom).emit('chat message', newMsg);
});
});

// أهم سطر - إرسال index.html
app.get('/', (req, res) => {
res.sendFile(path.join(__dirname, 'index.html'))
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 السيرفر جاهز على المنفذ: ${PORT}`));
