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

io.on('connection', (socket) => {
  console.log('مستخدم اتصل: ' + socket.id);
  
  socket.on('join', (data) => {
    socket.username = data.name;
    console.log(data.name + ' دخل');
    io.emit('chat message', {name: 'النظام', text: `${data.name} دخل الشات`});
  });

  socket.on('chat message', (data) => {
    console.log(data.name + ': ' + data.text);
    io.emit('chat message', data);
  });

  socket.on('disconnect', () => {
    if(socket.username){
      io.emit('chat message', {name: 'النظام', text: `${socket.username} خرج`});
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`10000 السيرفر شغال على المنفذ ${PORT}`));
