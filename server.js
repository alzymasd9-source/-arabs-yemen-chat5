const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// هذا السطر يخلي السيرفر يقرأ index.html صح في Render
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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

// نخزن آخر رسالة لكل مستخدم
const lastMessages = {};

io.on('connection', (socket) => {
  console.log('مستخدم اتصل: ' + socket.id);
  
  socket.on('join', (data) => {
    socket.username = data.name;
    console.log(data.name + ' دخل');
    io.emit('chat message', {name: 'النظام', text: `👋 ${data.name} انضم للغرفة`});
  });

  socket.on('chat message', (data) => {
    console.log(data.name + ': ' + data.text);
    const time = getDateNow();
    
    // خزن آخر رسالة للعضو
    lastMessages[data.name] = {text: data.text, time: time};
    
    io.emit('chat message', {name: data.name, text: data.text, time: time});
  });

  socket.on('disconnect', () => {
    if(socket.username){
      // انتظر 200ms عشان لو فيه رسالة أخيرة وصلت قبل الفصل
      setTimeout(() => {
        io.emit('chat message', {name: 'النظام', text: `👋 ${socket.username} غادر الغرفة`});
        delete lastMessages[socket.username];
      }, 200);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر شغال على المنفذ ${PORT}`));
