const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// تحديد المجلد الذي يحتوي على ملفات الواجهة الأمامية
app.use(express.static(path.join(__dirname, 'public')));

// إدارة اتصالات الشات
io.on('connection', (socket) => {
    console.log('مستخدم جديد اتصل بالشات');

    // استقبال الرسالة من مستخدم وإرسالها للجميع
    socket.on('chatMessage', (msg) => {
        io.emit('chatMessage', msg);
    });

    // عند خروج المستخدم
    socket.on('disconnect', () => {
        console.log('مستخدم غادر الشات');
    });
});

// تشغيل السيرفر على المنفذ 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على الرابط: http://localhost:${PORT}`);
});
