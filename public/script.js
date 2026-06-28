let socket, token, user, currentRoom = 'عام اليمن', muted = false;

const $ = id => document.getElementById(id);

// ===== 1. تسجيل + دخول =====
async function register(){
  const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:$('name').value,password:$('pass').value,gender:$('gender').value,age:$('age').value})
  });
  const data = await res.json();
  if(data.error) return $('loginError').innerText=data.error;
  saveSession(data);
}

async function login(){
  const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:$('name').value,password:$('pass').value})
  });
  const data = await res.json();
  if(data.error) return $('loginError').innerText=data.error;
  saveSession(data);
}

function saveSession(data){
  token = data.token; user = data.user;
  localStorage.setItem('token',token); localStorage.setItem('user',JSON.stringify(user));
  startChat();
}

// ===== 2. بدء الشات + Socket =====
async function startChat(){
  $('login').classList.add('hidden');
  $('chat').classList.remove('hidden');
  if(user.rank==='مالك' || user.rank==='اداري') $('adminBtn').classList.remove('hidden');

  socket = io();
  const userId = JSON.parse(atob(token.split('.')[1])).id;
  socket.emit('join',{userId, room: currentRoom});

  loadRooms(); loadMessages();

  socket.on('message', m => addMsg(m));
  socket.on('system', txt => $('messages').innerHTML += `<div style="color:#94a3b8;text-align:center;font-size:12px;margin:5px 0">${txt}</div>`);
  socket.on('users', list => renderUsers(list));
  socket.on('muted', sec => { muted=true; $('msgInput').disabled=true; setTimeout(()=>{muted=false;$('msgInput').disabled=false}, sec*1000); alert(`تم كتمك ${sec} ثانية`); });
  socket.on('error', e => alert(e));
}

function addMsg(m){
  const badge = m.rank==='مالك'?'malik':m.rank==='اداري'?'adari':m.rank==='مشرف'?'mushref':'';
  $('messages').innerHTML += `<div class="msg"><span class="badge ${badge}">${m.rank}</span><span class="name">${m.name}</span>: ${m.msg}</div>`;
  $('messages').scrollTop = $('messages').scrollHeight;
}

function sendMsg(){
  if(muted) return alert('انت مكتوم');
  const msg = $('msgInput').value.trim(); if(!msg) return;
  socket.emit('chatMessage',{msg}); $('msgInput').value='';
}

// ===== 3. نظام الغرف =====
async function loadRooms(){
  const rooms = await fetch('/api/rooms').then(r=>r.json());
  $('rooms').innerHTML = rooms.map(r=>`<div class="room ${r.name===currentRoom?'active':''}" onclick="joinRoom('${r.name}')">${r.name}</div>`).join('');
}
async function loadMessages(){
  const msgs = await fetch('/api/messages/'+encodeURIComponent(currentRoom)).then(r=>r.json());
  $('messages').innerHTML = msgs.map(m=>`<div class="msg"><span class="badge ${m.rank==='مالك'?'malik':m.rank==='اداري'?'adari':m.rank==='مشرف'?'mushref':''}">${m.rank}</span><span class="name">${m.name}</span>: ${m.msg}</div>`).join('');
  $('messages').scrollTop = $('messages').scrollHeight;
}
function joinRoom(name){
  currentRoom=name; $('roomName').innerText=name;
  const userId = JSON.parse(atob(token.split('.')[1])).id;
  socket.emit('join',{userId, room: name});
  loadRooms(); loadMessages();
}

// ===== 4. قائمة المتصلين + كتم + طرد =====
function renderUsers(list){
  $('users').innerHTML = list.map(u=>{
    let btns = '';
    if(user.rank==='مشرف' || user.rank==='اداري' || user.rank==='مالك'){
      btns += `<button style="font-size:10px;padding:2px 5px;margin-right:5px" onclick="muteUser('${u.id}',60)">كتم</button>`;
    }
    if(user.rank==='اداري' || user.rank==='مالك'){
      btns += `<button style="font-size:10px;padding:2px 5px;background:#dc2626" onclick="kickUser('${u.id}')">طرد</button>`;
    }
    return `<div class="user"><span class="badge ${u.rank==='مالك'?'malik':u.rank==='اداري'?'adari':u.rank==='مشرف'?'mushref':''}">${u.rank}</span>${u.name} ${btns}</div>`;
  }).join('');
  $('usersCount').innerText = list.length;
}
function muteUser(targetId, sec){ socket.emit('mute',{targetId,time:sec}); }
function kickUser(targetId){ if(confirm('متأكد تبغى تطرده؟')) socket.emit('kick',{targetId}); }

// ===== 5. الملف الشخصي - تعديل وتغير =====
function showProfile(){
  $('chat').classList.add('hidden'); $('profile').classList.remove('hidden');
  $('pAvatar').value=user.avatar||''; $('pBio').value=user.bio||''; $('pAge').value=user.age||'';
}
function hideProfile(){$('profile').classList.add('hidden');$('chat').classList.remove('hidden');}
async function saveProfile(){
  await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({avatar:$('pAvatar').value,bio:$('pBio').value,age:$('pAge').value})
  });
  user.avatar=$('pAvatar').value; user.bio=$('pBio').value; user.age=$('pAge').value;
  localStorage.setItem('user',JSON.stringify(user));
  alert('تم الحفظ'); hideProfile();
}

// ===== 6. لوحة تحكم المالك - كامل الصلاحيات =====
function showAdmin(){$('chat').classList.add('hidden');$('admin').classList.remove('hidden');}
function hideAdmin(){$('admin').classList.add('hidden');$('chat').classList.remove('hidden');}

async function setRank(){
  const name=$('aName').value, rank=$('aRank').value;
  const res = await fetch('/api/admin/setRank',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name,rank})});
  alert((await res.json()).success?'تمت الترقية':'فشل');
}
async function banUser(){
  const res = await fetch('/api/admin/ban',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name:$('bName').value})});
  alert((await res.json()).success?'تم الحظر':'فشل');
}
async function unbanUser(){
  const res = await fetch('/api/admin/unban',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name:$('bName').value})});
  alert((await res.json()).success?'تم فك الحظر':'فشل');
}
async function createRoom(){
  const res = await fetch('/api/admin/createRoom',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name:$('rName').value,type:'عام'})});
  alert((await res.json()).success?'تم انشاء الغرفة':'فشل'); loadRooms();
}
async function clearUserMsgs(){
  const res = await fetch('/api/admin/clearUser',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
    body:JSON.stringify({name:$('bName').value})});
  alert((await res.json()).success?'تم مسح رسائله':'فشل');
}

function logout(){localStorage.clear();location.reload();}

// ===== 7. تشغيل تلقائي اذا مسجل قبل =====
if(localStorage.getItem('token')){
  token = localStorage.getItem('token');
  user = JSON.parse(localStorage.getItem('user'));
  startChat();
}