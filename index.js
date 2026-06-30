const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    let currentRoom = '';

    // عندما يطلب المستخدم الانضمام لغرفة معينة
    socket.on('join room', (roomName) => {
        // إذا كان في غرفة سابقة، يخرج منها أولاً
        if(currentRoom) {
            socket.leave(currentRoom);
        }
        
        currentRoom = roomName;
        socket.join(roomName); // إدخال المستخدم للغرفة برمجياً

        // إرسال رسالة نظام لكل الموجودين في الغرفة تفيد بدخول مستخدم جديد
        io.to(roomName).emit('chat message', {
            isSystem: true,
            text: `📢 مستخدم جديد انضم إلى [ ${roomName} ]`
        });
    });

    // استقبال الرسالة وتوجيهها للغرفة المحددة فقط
    socket.on('chat message', (data) => {
        io.to(data.room).emit('chat message', data);
    });

    socket.on('disconnect', () => {
        if(currentRoom) {
            io.to(currentRoom).emit('chat message', {
                isSystem: true,
                text: `❌ غادر أحد المستخدمين الغرفة`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`الشات المطور يعمل على المنفذ ${PORT}`);
});
