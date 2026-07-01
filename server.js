/**
 * server.js
 * خادم Node.js متكامل وجاهز للرفع على منصة Render
 * يدعم المحادثات الفورية وإدارة قائمة المتصلين تلقائياً.
 */

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // السماح بالاتصالات من أي مكان لمنع مشاكل الـ CORS في المتصفحات
    methods: ["GET", "POST"]
  }
});

// 1. خدمة الملفات الثابتة من مجلد المشروع الأساسي
app.use(express.static(path.join(__dirname)));

// 2. حل مشكلة (Cannot GET /) - مسار صريح لإرسال ملف الواجهة فوراً عند فتح الرابط
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// مصفوفة لتخزين المستخدمين المتصلين: { id, name, gender, room }
let activeUsers = [];

// 3. إدارة اتصالات الشات الفورية عبر Socket.io
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

    // إرسال قائمة الأعضاء المحدثة لجميع من في الغرفة فوراً
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

  // عند قطع الاتصال أو خروج المستخدم
  socket.on("disconnect", () => {
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

      // تحديث قائمة الأعضاء للغرفة بعد الخروج
      const roomUsers = activeUsers.filter(u => u.room === user.room);
      io.to(user.room).emit("roomUsersList", roomUsers);
    }
    console.log(`المستخدم فصل: ${socket.id}`);
  });
});

// 4. إعداد المنفذ (PORT) ليتوافق مع خوادم Render تلقائياً
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`الخادم يعمل بنجاح على المنفذ ${PORT}`);
});
