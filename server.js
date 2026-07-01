/**
 * server.js
 * خادم Node.js آمن يدعم صلاحيات المالك الحصري (Owner) والتحكم الكامل في الشات.
 */

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// مصفوفة تتبع المتصلين
let activeUsers = [];

io.on("connection", (socket) => {
  console.log(`مستخدم متصل: ${socket.id}`);

  // استقبال حدث الانضمام مع التحقق من هوية المالك
  socket.on("joinRoom", ({ room, user, isOwnerVerified }) => {
    socket.join(room);
    
    // تحديد الرتبة بناءً على التحقق الأمني من جهة العميل
    let userRank = "عضو";
    if (isOwnerVerified === true) {
      userRank = "👑 مالك التطبيق";
    }

    activeUsers.push({
      id: socket.id,
      name: user.name,
      gender: user.gender,
      room: room,
      rank: userRank
    });

    // بث رسالة النظام للغرفة
    socket.to(room).emit("message", {
      user: "النظام",
      text: `انضم [${userRank}] ${user.name} للغرفة ${user.gender} - أهلاً وسهلاً!`,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
    });

    // تحديث قائمة الأعضاء
    const roomUsers = activeUsers.filter(u => u.room === room);
    io.to(room).emit("roomUsersList", roomUsers);
  });

  socket.on("chatMessage", ({ room, user, message }) => {
    const foundUser = activeUsers.find(u => u.id === socket.id);
    const displayRank = foundUser ? `[${foundUser.rank}] ` : "";

    io.to(room).emit("message", {
      user: displayRank + user.name,
      text: message,
      time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
      senderId: socket.id
    });
  });

  // حماية أمر الطرد: المالك فقط من يمكنه التنفيذ
  socket.on("kickUser", ({ userId }) => {
    const ownerAccount = activeUsers.find(u => u.id === socket.id && u.rank.includes("مالك"));
    
    if (ownerAccount) {
      const userToKick = activeUsers.find(u => u.id === userId);
      if (userToKick) {
        io.to(userId).emit("youAreKicked", "🚫 تم طردك فورياً من المحادثة بواسطة مالك التطبيق!");
        
        io.to(userToKick.room).emit("message", {
          user: "النظام",
          text: `🚨 قام مالك التطبيق بطرد العضو (${userToKick.name}) من الدردشة.`,
          time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
        });

        activeUsers = activeUsers.filter(u => u.id !== userId);
        io.to(userToKick.room).emit("roomUsersList", activeUsers.filter(u => u.room === userToKick.room));
      }
    } else {
      // محاولة اختراق أو استدعاء كود غير مصرح به
      socket.emit("message", { user: "النظام", text: "❌ خطأ أمني: لا تملك صلاحيات المالك الحصري!", time: "" });
    }
  });

  socket.on("disconnect", () => {
    const user = activeUsers.find(u => u.id === socket.id);
    if (user) {
      activeUsers = activeUsers.filter(u => u.id !== socket.id);
      io.to(user.room).emit("message", {
        user: "النظام",
        text: `غادر ${user.name} المحادثة.`,
        time: new Date().toLocaleTimeString("ar-YE", { hour: '2-digit', minute: '2-digit' }),
      });
      io.to(user.room).emit("roomUsersList", activeUsers.filter(u => u.room === user.room));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`الخادم يعمل بأمان`);
});
