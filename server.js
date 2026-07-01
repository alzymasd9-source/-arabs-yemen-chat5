/**
 * server.js
 * خادم Node.js متكامل لإدارة غرف شات اليمن العربي والأعضاء المتصلين فورياً.
 */

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// خدمة الملفات الثابتة من مجلد المشروع
app.use(express.static(path.join(__dirname)));

// مصفوفة لتخزين المستخدمين المتصلين: { id, name, gender, room }
let activeUsers = [];

io.on("connection", (socket) => {
  console.log(`مستخدم متصل: ${socket.id}`);

  // استقبال حدث الانضمام للغرفة
  socket.on("joinRoom", ({ room, user }) => {
    socket.join(room);
    
    // حفظ بيانات المستخدم الحالي في المصفوفة
    activeUsers.push({
      id: socket.id,
      name: user.name,
      gender: user.gender,
      room: room
    });

    // بث رسالة ترحيبية لكل المتواجدين في الغرفة عدا المستخدم نفسه
    socket.to(room).emit("message", {
      user: "النظام",
      text: `انضم ${user.name} للغرفة ${user.gender} - أهلاً وسهلاً!`,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
    });

    // إرسال قائمة الأعضاء المحدثة لجميع من في الغرفة
    const roomUsers = activeUsers.filter(u => u.room === room);
    io.to(room).emit("roomUsersList", roomUsers);
  });

  // استقبال الرسائل وإعادة بثها لجميع المتواجدين في الغرفة
  socket.on("chatMessage", ({ room, user, message }) => {
    io.to(room).emit("message", {
      user: user.name,
      text: message,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
      senderId: socket.id
    });
  });

  // عند قطع الاتصال أو الخروج
  socket.on("disconnect", () => {
    // البحث عن المستخدم المغادر قبل حذفه لإرسال إشعار خروج للغرفة
    const user = activeUsers.find(u => u.id === socket.id);
    
    if (user) {
      // حذفه من القائمة النشطة
      activeUsers = activeUsers.filter(u => u.id !== socket.id);
      
      // إرسال رسالة مغادرة للغرفة
      io.to(user.room).emit("message", {
        user: "النظام",
        text: `غادر ${user.name} المحادثة.`,
        time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
      });

      // تحديث قائمة الأعضاء للغرفة بعد خروج المستخدم
      const roomUsers = activeUsers.filter(u => u.room === user.room);
      io.to(user.room).emit("roomUsersList", roomUsers);
    }
    console.log(`المستخدم فصل: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
});
