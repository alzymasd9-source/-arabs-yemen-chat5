const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/yemenchat');

const Room = mongoose.model('Room', { name: String });
const Message = mongoose.model('Message', { roomId: String, user: Object, text: String, time: Date });

io.on('connection', (socket) => {
  let myUserData = {};

  socket.on('join', async (data) => {
    myUserData = data;
    socket.emit('rooms', await Room.find());
  });

  socket.on('joinRoom', async (roomId) => {
    socket.join(roomId);
    const msgs = await Message.find({roomId}).sort({time: 1}).limit(50);
    socket.emit('oldMessages', msgs);
    io.to(roomId).emit('users', [{...myUserData, socketId: socket.id}]);
  });

  socket.on('sendMessage', async ({roomId, text, user}) => {
    const msg = new Message({roomId, user, text, time: new Date()});
    await msg.save();
    io.to(roomId).emit('message', msg);
  });
});

app.get('/init', async (req,res) => {
  if(await Room.countDocuments() === 0){
    await Room.insertMany([{name:'عام'}, {name:'تعارف'}, {name:'وناسة'}]);
  }
  res.send('تم انشاء الغرف');
});

server.listen(process.env.PORT || 3000, () => console.log('Server ON'));