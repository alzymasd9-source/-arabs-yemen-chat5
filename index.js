const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

// قائمة لتخزين الأسماء المحظورة مؤقتاً في الذاكرة
const bannedUsers = new Set();

io.on('connection', (socket) => {
    let currentRoom = '';
    let myName = '';

    socket.on('join room', (data) => {
        // التحقق أولاً إذا كان الاسم محظوراً
        if (bannedUsers.has(data.name)) {
            socket.emit('banned', 'نأسف، هذا الاسم محظور من دخول الشات!');
            return;
        }

        if(currentRoom) { socket.leave(currentRoom); }
        
        currentRoom = data.room;
        myName = data.name;
        socket.join(currentRoom);

        // حفظ اسم المستخدم داخل السوكيت للوصول إليه عند الحظر
        socket.username = myName;

        io.to(currentRoom).emit('chat message', {
            isSystem: true,
            text: `📢 [ ${myName} ] انضم إلى الغرفة`
        });
    });

    socket.on('chat message', (data) => {
        // منع إرسال الرسالة إذا تم حظر المستخدم أثناء الجلسة
        if (bannedUsers.has(data.name)) {
            socket.emit('banned', 'تم حظرك مؤخراً، لا يمكنك إرسال رسائل.');
            return;
        }
        io.to(data.room).emit('chat message', data);
    });

    // استقبال أمر الحظر من المشرفين
    socket.on('admin ban user', (targetName) => {
        bannedUsers.add(targetName); // إضافة الاسم لقائمة الحظر

        // إرسال إشعار للغرفة بالطرد
        io.to(currentRoom).emit('chat message', {
            isSystem: true,
            text: `🚫 قام الإشراف بحظر المستخدم [ ${targetName} ] وطره من الشات!`
        });

        // البحث عن اتصال الشخص المحظور وفصله فوراً
        io.sockets.sockets.forEach((s) => {
            if (s.username === targetName) {
                s.emit('banned', 'لقد تم حظرك من قبل إدارة الشات للمخالفة.');
                s.disconnect(true);
            }
        });
    });

    socket.on('disconnect', () => {
        if(currentRoom && myName && !bannedUsers.has(myName)) {
            io.to(currentRoom).emit('chat message', {
                isSystem: true,
                text: `❌ غادر [ ${myName} ] الغرفة`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`الشات المطور مع نظام الحظر يعمل على المنفذ ${PORT}`);
});
