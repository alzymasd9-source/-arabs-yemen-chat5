const socket = io();
let currentUser = JSON.parse(localStorage.getItem('user'));
let currentRoom = localStorage.getItem('room') || 'general';

const API_URL = 'http://localhost:3000/api';
const token = localStorage.getItem('token');

// التحقق من المصادقة
if (!currentUser || !token) {
  window.location.href = '/';
}

// الاتصال
socket.on('connect', () => {
  console.log('متصل بالسيرفر');
  joinRoom(currentRoom);
});

// دخول الغرفة
function joinRoom(roomId) {
  currentRoom = roomId;
  localStorage.setItem('room', roomId);
  
  socket.emit('joinRoom', {
    userId: currentUser._id,
    roomId: roomId,
    username: currentUser.username,
    rank: currentUser.rank,
    gender: currentUser.gender,
    avatar: currentUser.profilePicture
  });

  document.getElementById('roomName').textContent = roomId.toUpperCase();
  document.getElementById('messagesContainer').innerHTML = '';
}

// استقبال الرسائل
socket.on('receiveMessage', (msg) => {
  displayMessage(msg);
});

// عرض الرسالة
function displayMessage(msg) {
  const container = document.getElementById('messagesContainer');
  const msgElement = document.createElement('div');
  msgElement.className = 'message d-flex gap-2';
  
  let borderColor = 'border-primary';
  if (msg.gender === 'أنثى') borderColor = 'border-danger';
  else if (msg.gender === 'آخر') borderColor = 'border-secondary';

  const timestamp = new Date(msg.timestamp).toLocaleString('ar-YE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  msgElement.innerHTML = `
    <div>
      <img src="${msg.avatar || '/images/default.jpg'}" alt="${msg.username}" 
           class="rounded-circle ${borderColor} border-2" 
           width="40" height="40" style="cursor: pointer;"
           onclick="showUserCard('${msg.userId}')">
    </div>
    <div class="flex-grow-1">
      <div class="d-flex align-items-center gap-2">
        <strong onclick="showUserCard('${msg.userId}')" style="cursor: pointer;">
          ${msg.rank} ${msg.username}
        </strong>
        <small class="text-muted">${timestamp}</small>
        <div class="dropdown">
          <button class="btn btn-sm btn-link" data-bs-toggle="dropdown">•••</button>
          <ul class="dropdown-menu">
            <li><a class="dropdown-item" onclick="reportMessage('${msg.id}', '${msg.username}')">ابلاغ</a></li>
            ${currentUser.userType === 'admin' ? 
              `<li><a class="dropdown-item" onclick="deleteMessage('${msg.id}')">حذف</a></li>` : ''}
          </ul>
        </div>
      </div>
      <div class="message-content bg-light p-2 rounded mt-1">
        ${msg.content}
      </div>
    </div>
  `;
  
  container.appendChild(msgElement);
  container.scrollTop = container.scrollHeight;
}

// إرسال رسالة
document.getElementById('sendBtn').addEventListener('click', () => {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  
  if (content) {
    socket.emit('sendMessage', {
      content: content,
      roomId: currentRoom,
      userId: currentUser._id,
      username: currentUser.username,
      rank: currentUser.rank,
      gender: currentUser.gender,
      avatar: currentUser.profilePicture
    });
    
    input.value = '';
  }
});

// الإبلاغ عن رسالة
function reportMessage(messageId, username) {
  const reason = prompt(`ابلاغ عن رسالة من ${username}\nالسبب:\n1. اساءة\n2. محتوى احتيال\n3. غير ذلك`);
  
  if (reason) {
    socket.emit('reportMessage', {
      messageId: messageId,
      reportedBy: currentUser._id,
      reason: reason,
      roomId: currentRoom
    });
    alert('✓ تم الإبلاغ');
  }
}

// تحديث المتواجدين
socket.on('updateOnlineUsers', (users) => {
  const usersList = document.getElementById('onlineUsers');
  usersList.innerHTML = '';
  
  users.forEach(user => {
    const userEl = document.createElement('div');
    userEl.className = 'list-group-item d-flex align-items-center justify-content-between';
    userEl.innerHTML = `
      <span onclick="showUserCard('${user.userId}')" style="cursor: pointer;">
        ${user.rank} ${user.username}
      </span>
      ${currentUser.userType !== 'visitor' && user.userId !== currentUser._id ? 
        `<button class="btn btn-sm btn-link" onclick="addFriend('${user.userId}')">➕</button>` : ''}
    `;
    usersList.appendChild(userEl);
  });
});

// إظهار بطاقة المستخدم
function showUserCard(userId) {
  fetch(`${API_URL}/users/profile/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  .then(r => r.json())
  .then(data => {
    const { user } = data;
    const card = document.createElement('div');
    card.className = 'position-fixed top-50 start-50 translate-middle bg-white p-4 rounded shadow-lg';
    card.style.zIndex = '1000';
    card.style.width = '350px';
    
    card.innerHTML = `
      <button class="btn-close position-absolute top-0 end-0 m-2" onclick="this.parentElement.remove()"></button>
      <div class="text-center">
        <img src="${user.profilePicture}" alt="" class="rounded-circle mb-2" width="100" height="100">
        <h5>${user.rank} ${user.username}</h5>
        <small>${user.age} سنة • ${user.gender} • 🇾🇪</small>
        <p class="mt-2 text-muted">${user.bio || 'بدون وصف'}</p>
      </div>
      <div class="d-grid gap-2 mt-3">
        <button class="btn btn-primary btn-sm" onclick="goToProfile('${userId}')">عرض الملف</button>
        <button class="btn btn-info btn-sm">رسالة خاصة</button>
        ${currentUser.userType !== 'visitor' ? 
          `<button class="btn btn-success btn-sm" onclick="addFriend('${userId}')">إضافة صديق</button>` : ''}
      </div>
    `;
    
    document.body.appendChild(card);
  });
}

// تخزين المحادثات
document.getElementById('messageInput').addEventListener('input', (e) => {
  if (e.target.value.length > 0) {
    socket.emit('typing', { roomId: currentRoom, username: currentUser.username });
  }
});

document.getElementById('messageInput').addEventListener('blur', () => {
  socket.emit('stopTyping', { roomId: currentRoom, username: currentUser.username });
});

// عرض المتواجدين
function showOnline() {
  const panel = document.querySelector('[id="onlineUsers"]').parentElement;
  panel.classList.toggle('d-none');
}

// خروج من الموقع
function logout() {
  socket.emit('leaveRoom', { roomId: currentRoom });
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}
