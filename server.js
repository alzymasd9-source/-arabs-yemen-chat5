const express = require('express');
const app = express();
const http = require('http').createServer(app);
// رفع حد البيانات إلى 50 ميجابايت للسماح بنقل التسجيلات الصوتية والصور ومقاطع الرسم
const io = require('socket.io')(http, { maxHttpBufferSize: 5e7, cors: { origin: "*" } }); 
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcryptjs');

// الاتصال بقاعدة بيانات MongoDB السحابية
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatDBFinal')
    .then(() => console.log('✅ متصل بنجاح بقاعدة البيانات السحابية والمحلية'))
    .catch(err => console.error('❌ خطأ في قاعدة البيانات:', err));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));
app.use(session({ secret: 'SuperSecretChatKeyYemen2026', resave: false, saveUninitialized: true }));

// جدول حسابات الأعضاء والإدارة
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: 'member' }, // owner, admin, management, moderator, member
    isBanned: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    badge: { type: String, default: '' },
    points: { type: Number, default: 100 }
});
const User = mongoose.model('User', userSchema);

// جدول الرسائل والميديا وأرشيف الغرف
const messageSchema = new mongoose.Schema({
    room: String, user: String, role: String, text: String,
    type: { type: String, default: 'text' }, // text, image, file, voice, draw, youtube
    fileName: String, fileBuffer: String, replyTo: Object, timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// مسار تسجيل عضوية ذكي (أول حساب يسجل يمنح رتبة المالك تلقائياً بصلاحيات مطلقة)
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        const userExists = await User.findOne({ username });
        if (userExists) return res.status(400).json({ error: 'اسم المستخدم مسجل مسبقاً!' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const totalUsers = await User.countDocuments({});
        
        // أول حساب يسجل يصبح مالك الشات بصلاحيات مطلقة
        const assignedRole = totalUsers === 0 ? 'owner' : 'member';

        const newUser = new User({ 
            username: username, password: hashedPassword, email: email, role: assignedRole 
        });
        await newUser.save();
        res.json({ success: `تم حفظ العضوية بنجاح! رتبتك الحالية: ${assignedRole === 'owner' ? 'المالك 👑' : 'عضو'}` });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ في السيرفر' });
    }
});

// مسار تسجيل الدخول والتحقق من الحظر
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة!' });
        if (user.isBanned) return res.status(403).json({ error: 'حسابك محظور نهائياً من دخول الشات بقرار إداري!' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'بيانات الدخول غير صحيحة!' });

        req.session.user = { id: user._id, name: user.username, role: user.role, points: user.points };
        res.json({ success: true, user: req.session.user });
    } catch (err) {
        res.status(500).json({ error: 'خطأ في السيرفر' });
    }
});

// قائمة المتواجدين النشطين في الغرف
let activeUsers = {};

io.on('connection', (socket) => {
    
    // الانضمام لغرفة والتحقق من الرتب لإدراجها في شريط المتواجدين الأعلى رتبة
    socket.on('join room', async ({ roomName, user, role }) => {
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
            // إعلان المغادرة
            io.to(socket.currentRoom).emit('sys message', { text: `🚪 غادر الغرفة: ${user} [${role}]` });
            if (activeUsers[socket.currentRoom]) {
                activeUsers[socket.currentRoom] = activeUsers[socket.currentRoom].filter(u => u.id !== socket.id);
                io.to(socket.currentRoom).emit('update users', activeUsers[socket.currentRoom]);
            }
        }

        socket.join(roomName);
        socket.currentRoom = roomName;
        socket.username = user;
        socket.role = role;

        // إعلان الانضمام للغرفة
        io.to(roomName).emit('sys message', { text: `✨ انضم للغرفة: ${user} [${role}]` });

        // إضافة المستخدم لقائمة المتواجدين النشطة
        if (!activeUsers[roomName]) activeUsers[roomName] = [];
        activeUsers[roomName].push({ id: socket.id, name: user, role: role });
        
        // ترتيب المتواجدين بحيث تظهر أعلى رتبة (owner ثم admin ثم management...) في الأعلى
        const roleOrder = { owner: 1, admin: 2, management: 3, moderator: 4, member: 5, guest: 6 };
        activeUsers[roomName].sort((a, b) => (roleOrder[a.role] || 7) - (roleOrder[b.role] || 7));

        io.to(roomName).emit('update users', activeUsers[roomName]);

        // تحميل أرشيف الرسائل للغرفة
        const oldMsgs = await Message.find({ room: roomName }).sort({ timestamp: -1 }).limit(40);
        socket.emit('load old messages', oldMsgs.reverse());
    });

    // استقبال الرسائل وتوزيعها (مع دعم الرد الفوري والاقتباس)
    socket.on('chat message', async (data) => {
        const userCheck = await User.findOne({ username: socket.username });
        if(userCheck && userCheck.isMuted) {
            return socket.emit('sys message', { text: '⚠️ أنت مكتوم حالياً من قبل الإدارة، لا يمكنك إرسال رسائل.' });
        }

        const newMsg = new Message({
            room: socket.currentRoom, user: data.user, role: data.role,
            text: data.text, type: data.type, fileName: data.fileName, fileBuffer: data.fileBuffer,
            replyTo: data.replyTo
        });
        await newMsg.save();
        io.to(socket.currentRoom).emit('chat message', newMsg);
    });

    // صلاحيات المالك والإدارة المطلقة: طرد، حظر، كتم، إلغاء كتم
    socket.on('admin action', async ({ action, targetName, executerRole }) => {
        if (!['owner', 'admin', 'management', 'moderator'].includes(executerRole)) return;

        const targetUser = await User.findOne({ username: targetName });
        if (!targetUser && action !== 'kick') return;

        if (action === 'ban' && ['owner', 'admin'].includes(executerRole)) {
            await User.findOneAndUpdate({ username: targetName }, { isBanned: true });
            io.emit('force out', { targetName, reason: 'الحظر النهائي 🚫' });
        } else if (action === 'mute') {
            await User.findOneAndUpdate({ username: targetName }, { isMuted: true });
            io.to(socket.currentRoom).emit('sys message', { text: `🤫 تم كتم العضو ${targetName} بواسطة الإدارة.` });
        } else if (action === 'unmute') {
            await User.findOneAndUpdate({ username: targetName }, { isMuted: false });
            io.to(socket.currentRoom).emit('sys message', { text: `🔊 تم إلغاء كتم العضو ${targetName} وبإمكانه التحدث الآن.` });
        } else if (action === 'kick') {
            io.to(socket.currentRoom).emit('force out', { targetName, reason: 'الطرد المؤقت من الغرفة 🚪' });
        }
    });

    socket.on('disconnect', () => {
        if (socket.currentRoom && activeUsers[socket.currentRoom]) {
            io.to(socket.currentRoom).emit('sys message', { text: `🚪 غادر الغرفة: ${socket.username} [${socket.role}]` });
            activeUsers[socket.currentRoom] = activeUsers[socket.currentRoom].filter(u => u.id !== socket.id);
            io.to(socket.currentRoom).emit('update users', activeUsers[socket.currentRoom]);
        }
    });
});

app.get('/api/admin/users', async (req, res) => {
    const users = await User.find({}, '-password');
    res.json(users);
});
app.post('/api/admin/update-role', async (req, res) => {
    const { userId, newRole } = req.body;
    await User.findByIdAndUpdate(userId, { role: newRole });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`🚀 السيرفر الخارق جاهز على المنفذ: ${PORT}`));
              
