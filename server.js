const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

app.use(express.json());
app.set('trust proxy', true); // عشان نجيب IP صح
app.use(express.static('public'));
app.use('/uploads', express.static('public/uploads'));
if(!fs.existsSync('./public/uploads')) fs.mkdirSync('./public/uploads',{recursive:true});

    mongoose.connect(process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/yemenchat');
const JWT_SECRET = "yemen123";
const ADMIN_KEY = "owner123";
const ROLES = { 'مالك':5, 'ادمن':4, 'مشرف':3, 'مميز':2, 'عضو':1, 'زائر':0 };

// 1. جداول DB
const User = mongoose.model('User', new mongoose.Schema({
  name:{type:String, unique:true}, pass:String, email:String, gender:String,
  age:Number, role:{type:String, default:'زائر'}, points:{type:Number, default:100},
  premium:{type:Boolean, default:false}, color:{type:String, default:'#fff'}, ip:String,
  banned:{type:Boolean, default:false}, banReason:String
}));
const Message = mongoose.model('Message', new mongoose.Schema({
  room:String, name:String, role:String, gender:String, premium:Boolean, color:String,
  text:String, type:String, time:{type:Date, default:Date.now}
}));
const Ban = mongoose.model('Ban', new mongoose.Schema({
  ip:String, reason:String, by:String, time:{type:Date, default:Date.now}, expire:Date
}));

const Shop = [{id:'premium',name:'عضوية مميزة 7 ايام',price:200},{id:'color',name:'تغيير لون الاسم',price:50}];

// 2. رفع ملفات
const upload = multer({dest:'./public/uploads/', fileFilter:(req,f,cb)=>cb(null, f.mimetype.startsWith('image/') || f.mimetype==='application/pdf' || f.mimetype.startsWith('audio/'))});
app.post('/upload', upload.single('file'), (req,res)=>{
  res.json({url:'/uploads/'+path.basename(req.file.path)});
});

// 3. API
app.post('/register', async (req,res)=>{
  const ip = req.ip;
  if(await Ban.findOne({ip, $or:[{expire:null},{expire:{$gt:new Date()}}]})) return res.status(403).json({err:'IP محظور'});
  const {name, pass, email, gender} = req.body;
  if(await User.findOne({name})) return res.status(400).json({err:'الاسم موجود'});
  const age = Math.floor(Math.random()*80)+20;
  await User.create({name, pass:await bcrypt.hash(pass,10), email, gender, age, role:'عضو', ip});
  res.json({ok:1});
});

app.post('/guest', async (req,res)=>{
  const ip = req.ip;
  if(await Ban.findOne({ip, $or:[{expire:null},{expire:{$gt:new Date()}}]})) return res.status(403).json({err:'IP محظور'});
  const {name, gender} = req.body;
  const age = Math.floor(Math.random()*80)+20;
  const token = jwt.sign({name, gender, age, role:'زائر', ip, temp:1, points:0, premium:0, color:'#fff'}, JWT_SECRET);
  res.json({token});
});

app.post('/login', async (req,res)=>{
  const ip = req.ip;
  if(await Ban.findOne({ip, $or:[{expire:null},{expire:{$gt:new Date()}}]})) return res.status(403).json({err:'IP محظور'});
  const {name, pass, key} = req.body;
  const user = await User.findOne({name});
  if(!user || user.banned) return res.status(400).json({err:'الحساب محظور'});
  if(!await bcrypt.compare(pass, user.pass)) return res.status(400).json({err:'خطأ'});
  user.ip = ip; await user.save();
  const role = key===ADMIN_KEY? 'مالك' : user.role;
  const token = jwt.sign({id:user._id, name:user.name, gender:user.gender, age:user.age, role, ip, points:user.points, premium:user.premium, color:user.color}, JWT_SECRET);
  res.json({token});
});

function auth(req,res,next){ try{req.user=jwt.verify(req.headers.token, JWT_SECRET); next();}catch(e){res.status(401).json({err:'no token'})} }

app.get('/history/:room', auth, async (req,res)=>res.json(await Message.find({room:req.params.room}).sort({time:1}).limit(50)));
app.get('/shop', auth, (req,res)=>res.json(Shop));
app.get('/banlog', auth, async (req,res)=>{ if(req.user.role!=='مالك')return res.status(403).json({err:'للمالك فقط'}); res.json(await Ban.find().sort({time:-1}).limit(50));});

app.post('/buy', auth, async (req,res)=>{
  const user = await User.findById(req.user.id);
  const item = Shop.find(i=>i.id===req.body.id);
  if(user.points<item.price) return res.status(400).json({err:'نقاطك قليلة'});
  user.points-=item.price;
  if(item.id==='premium') user.premium=true;
  if(item.id==='color') user.color=req.body.color;
  await user.save();
  const token = jwt.sign({...req.user, points:user.points, premium:user.premium, color:user.color}, JWT_SECRET);
  res.json({token});
});

app.post('/unban', auth, async (req,res)=>{
  if(req.user.role!== 'مالك') return res.status(403).json({err:'للمالك فقط'});
  await Ban.deleteOne({ip:req.body.ip});
  await User.updateOne({ip:req.body.ip}, {$set:{banned:false}});
  res.json({ok:1});
});

// 4. Socket
const online = new Map();

io.use(async (socket,next)=>{
  try{
    const ip = socket.handshake.address;
    if(await Ban.findOne({ip, $or:[{expire:null},{expire:{$gt:new Date()}}]})) return next(new Error('IP محظور'));
    socket.user=jwt.verify(socket.handshake.auth.token, JWT_SECRET);
    socket.user.ip = ip;
    next();
  }catch(e){next(new Error('invalid'));}
});

io.on('connection', (socket)=>{
  const u = socket.user;
  online.set(socket.id, {...u, muted:false, room:'ردهة', id:socket.id});
  socket.join('ردهة');
  io.to('ردهة').emit('chat message', {name:'النظام', text:`انضم ${u.name} [${u.role}] اهلا وسهلا`, system:1});
  updateUsers('ردهة');

  socket.on('chat message', async msg=>{
    const me = online.get(socket.id);
    if(me.muted) return;
    await Message.create({...u, room:me.room, text:msg, type:'text'});
    io.to(me.room).emit('chat message',{...u, id:socket.id, text:msg, type:'text'});
  });

  socket.on('chat media', async ({url, type})=>{
    const me = online.get(socket.id);
    await Message.create({...u, room:me.room, text:url, type});
    io.to(me.room).emit('chat message',{...u, id:socket.id, text:url, type});
  });

  socket.on('join room', (room)=>{
    socket.leaveAll(); socket.join(room);
    online.get(socket.id).room=room;
    io.to(room).emit('chat message', {name:'النظام', text:`انضم ${u.name} [${u.role}] اهلا وسهلا`, system:1});
    updateUsers(room);
  });

  socket.on('mod action', async ({action,targetId, minutes, reason, days})=>{
    const me=online.get(socket.id), target=online.get(targetId);
    if(!target) return;
    if(me.role!== 'مالك' && ROLES[me.role] <= ROLES[target.role]) return;

    if(action==='mute' && ROLES[me.role]>=3){
      target.muted=true; setTimeout(()=>target.muted=false,(minutes||5)*60000);
      io.to(targetId).emit('chat message',{name:'النظام', text:`تم كتمك ${minutes||5} دقيقة`});
    }
    if(action==='kick' && ROLES[me.role]>=4){
      io.to(targetId).emit('chat message',{name:'النظام', text:'تم طردك'});
      io.sockets.sockets.get(targetId).disconnect(true);
    }
    if(action==='banip' && me.role==='مالك'){
      const expire = days? new Date(Date.now()+days*86400000) : null;
      await Ban.create({ip:target.ip, reason:reason||'قرار المالك', by:me.name, expire});
      if(target.id){ io.to(targetId).emit('chat message',{name:'النظام', text:`تم حظرك ${days?'لمدة '+days+' يوم':'نهائي'}`}); io.sockets.sockets.get(targetId).disconnect(true); }
      await User.updateOne({name:target.name}, {$set:{banned:true, banReason:reason}});
    }
    if(action==='unbanip' && me.role==='مالك'){
      await Ban.deleteOne({ip:target.ip});
      await User.updateOne({name:target.name}, {$set:{banned:false}});
      socket.emit('chat message',{name:'النظام', text:`تم فك حظر ${target.name}`});
    }
  });

  socket.on('disconnect', ()=>{online.delete(socket.id); updateUsers('ردهة');});

  function updateUsers(room){ io.to(room).emit('room users', Array.from(online.values()).filter(x=>x.room===room)); }
});

http.listen(3000, ()=>console.log('http://localhost:3000'));