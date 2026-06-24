const express = require('express');
const app = express();
const http = require('http').createServer(app);
// رفع حد البيانات إلى 20 ميجابايت للسماح بنقل الصور والملفات الكبيرة عبر الويب سوكت
const io = require('socket.io')(http, { maxHttpBufferSize: 2e7 }); 
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');

// الاتصال بقاعدة بيانات MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatDBPlus')
    .then(() => console.log('✅ متصل بقاعدة البيانات بنجاح'))
    .catch(err => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname)));
app.use(session({
    secret: 'mySuperSecretChatKey',
    resave: false,
    saveUninitialized: true
}));

// جدول الأعضاء المطور
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'member' }, 
    isBanned: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

// جدول الرسائل والميديا
const messageSchema = new mongoose.Schema({
    room: String,
    user: String,
    role: String,
    text: String,
    type: { type: String, default: 'text' }, // 'text', 'image', 'file'
    fileName: String,
    fileBuffer: String, // تخزين الملف بصيغة Base64 للتبسيط
    timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// مسارات واجهة الشات ولوحة التحكم
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/dashboard', (req, res) => {
    if (req.session.user && ['owner', 'admin'].includes(req.session.user.role)) {
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    } else {
        res.status(403).send('<h1>غير مصرح لك بدخول لوحة التحكم!</h1>');
    }
});

// إدارة الويب سوكت (غرف، ميديا، وحظر فوري)
io.on('connection', (socket) => {
    socket.on('join room', async ({ roomName, user }) => {
        if (socket.currentRoom) socket.leave(socket.currentRoom);
        socket.join(roomName);
        socket.currentRoom = roomName;

        // جلب آخر 40 رسالة وميديا للغرفة المحددة
        const oldMsgs = await Message.find({ room: roomName }).sort({ timestamp: -1 }).limit(40);
        socket.emit('load old messages', oldMsgs.reverse());
    });

    socket.on('chat message', async (data) => {
        const newMsg = new Message({
            room: socket.currentRoom,
            user: data.user,
            role: data.role,
            text: data.text,
            type: data.type,
            fileName: data.fileName,
            fileBuffer: data.fileBuffer
        });
        await newMsg.save();
        io.to(socket.currentRoom).emit('chat message', data);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 السيرفر المطور يعمل على المنفذ: ${PORT}`));
