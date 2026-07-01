/**
 * server.js
 * خادم Node.js لخدمة ملف index.html وتقديم واجهة الشات الحقيقية باستخدام socket.io.
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

// إعداد socket.io للدردشة الحقيقية
io.on("connection", (socket) => {
  console.log(`مستخدم متصل: ${socket.id}`);

  // استقبال حدث الانضمام للغرفة
  socket.on("joinRoom", ({ room, user }) => {
    socket.join(room);
    
    // بث رسالة ترحيبية لكل المتواجدين في الغرفة عدا المستخدم المنضم حديثاً
    socket.to(room).emit("message", {
      user: "النظام",
      text: `انضم ${user.name} للغرفة (${user.gender}) - أهلاً وسهلاً!`,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
    });
  });

  // استقبال الرسائل وإعادة بثها لجميع المتواجدين في الغرفة
  socket.on("chatMessage", ({ room, user, message }) => {
    io.to(room).emit("message", {
      user: user.name,
      text: message,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
      senderId: socket.id // لتحديد هوية المرسل في الواجهة
    });
  });

  socket.on("disconnect", () => {
    console.log(`المستخدم فصل: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على http://localhost:${PORT}`);
});
