const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// تشغيل ملفات الواجهة الأمامية من مجلد public
app.use(express.static('public'));

// عند اتصال مستخدم جديد بالشات
io.on('connection', (socket) => {
    console.log('مستخدم جديد دخل الشات');

    // استقبال الرسالة من المستخدم وإرسالها للجميع فوراً
    socket.on('chat message', (data) => {
        io.emit('chat message', data);
    });

    socket.on('disconnect', () => {
        console.log('مستخدم غادر الشات');
    });
});

// تحديد منفذ التشغيل
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`الشات يعمل الآن على المنفذ ${PORT}`);
});
