const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// ملفات الموقع
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// دالة التاريخ والوقت: يوم/شهر ساعة:دقيقة ص/م
function getDateNow(){
  const d = new Date();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2,'0');
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${day}/${month} ${hours}:${minutes} ${ampm}`;
}

io.on('connection', (socket) => {
  console.log('مستخدم اتصل: ' + socket.id);
  
  socket.on('join', (data) => {
    socket.username = data.name;
    console.log(data.name + ' دخل');
    // رسالة النظام بدون وقت وتاريخ
    io.emit('chat message', {name: 'النظام', text: `👋 ${data.name} انضم للغرفة`});
  });

  socket.on('chat message', (data) => {
    console.log(data.name + ': ' + data.text);
    // الرسالة العادية مع الوقت والتاريخ
    io.emit('chat message', {name: data.name, text: data.text, time: getDateNow()});
  });

  socket.on('disconnect', () => {
    if(socket.username){
      // رسالة النظام بدون وقت وتاريخ
      io.emit('chat message', {name: 'النظام', text: `👋 ${socket.username} غادر الغرفة`});
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`10000 السيرفر شغال على المنفذ ${PORT}`));
