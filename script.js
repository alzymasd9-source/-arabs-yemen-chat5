// تعريف المتغيرات
const authModal = document.getElementById('auth-modal');
const showLoginBtn = document.getElementById('show-login');
const closeAuthBtn = document.getElementById('close-auth');
const authSubmitBtn = document.getElementById('auth-submit');
const authAction = document.getElementById('auth-action');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');

const chatSection = document.getElementById('chat-section');
const userNameSpan = document.getElementById('user-name');
const userRankSpan = document.getElementById('user-rank');
const membersList = document.getElementById('members');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message');
const sendBtn = document.getElementById('send-message');
const leaveBtn = document.getElementById('leave-chat');

let currentUser = null;
let users = {}; // لتخزين المستخدمين
let members = []; // قائمة الأعضاء المتصلين

// تعريف الرتب والصلاحيات
const RANKS = {
    'مالك': {name: 'مالك', permissions: ['all']},
    'ادارة': {name: 'إدارة', permissions: ['mute', 'kick', 'close/open']},
    'مشرف': {name: 'مشرف', permissions: ['mute']},
    'عضو مميز': {name: 'عضو مميز', permissions: []},
    'عضو': {name: 'عضو', permissions: []},
    'زائر': {name: 'زائر', permissions: []}
};

// فتح نافذة التسجيل
showLoginBtn.onclick = () => {
    authModal.style.display = 'block';
}
closeAuthBtn.onclick = () => {
    authModal.style.display = 'none';
}
window.onclick = (e) => {
    if (e.target == authModal) {
        authModal.style.display = 'none';
    }
}

// عملية التسجيل أو تسجيل الدخول
document.getElementById('auth-submit').onclick = () => {
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();
    const action = authAction.value;

    if (!username || !password) {
        alert('أملأ جميع الحقول');
        return;
    }

    if (action === 'register') {
        if (localStorage.getItem('user_' + username)) {
            alert('اسم المستخدم موجود بالفعل');
            return;
        }
        // تحديد رتبة بشكل عشوائي أو ثابت
        const ranks = Object.keys(RANKS);
        const rank = ranks[Math.floor(Math.random() * ranks.length)];
        const userData = {
            username,
            password,
            rank
        };
        localStorage.setItem('user_' + username, JSON.stringify(userData));
        alert('تم تسجيل حسابك، سجل الدخول الآن');
    } else if (action === 'login') {
        const storedUser = localStorage.getItem('user_' + username);
        if (storedUser) {
            const userData = JSON.parse(storedUser);
            if (userData.password === password) {
                // تسجيل الدخول
                currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                authModal.style.display = 'none';
                startChat();
            } else {
                alert('الباسور غير صحيح');
            }
        } else {
            alert('هذا المستخدم غير موجود');
        }
    }
}

// عند فتح الموقع، نتحقق من تسجيل دخول سابق
window.onload = () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        startChat();
    }
}

// بدء الدردشة
function startChat() {
    document.getElementById('show-login').style.display = 'none';
    document.getElementById('auth-modal').style.display = 'none';
    document.getElementById('chat-section').style.display = 'flex';
    document.getElementById('logout').style.display = 'inline-block';

    document.getElementById('user-name').innerText = currentUser.username;
    document.getElementById('user-rank').innerText = currentUser.rank;

    // إضافة المستخدم إلى القائمة
    if (!members.includes(currentUser.username)) {
        members.push(currentUser.username);
        updateMembers();
    }

    // عرض الرسائل القديمة (مؤقتا، يمكن تخزينها في LocalStorage)
    loadMessages();
}

// تحديث قائمة الأعضاء
function updateMembers() {
    membersList.innerHTML = '';
    members.forEach(member => {
        const li = document.createElement('li');
        li.innerText = member;
        // عند النقر على اسم عضو
        li.onclick = () => {
            if (member !== currentUser.username) {
                sendPrivateMessage(member);
            }
        };
        membersList.appendChild(li);
    });
}

// إرسال رسالة عامة
sendBtn.onclick = () => {
    const msg = messageInput.value.trim();
    if (msg && currentUser) {
        const messageObj = {
            sender: currentUser.username,
            content: msg,
            time: new Date().toLocaleTimeString(),
            type: 'public'
        };
        saveMessage(messageObj);
        displayMessage(messageObj);
        messageInput.value = '';
    }
}

// عرض الرسائل
function displayMessage(msg) {
    const div = document.createElement('div');
    if (msg.type === 'public') {
        div.innerHTML = `<strong>${msg.sender}</strong>: ${msg.content} <em>(${msg.time})</em>`;
    } else if (msg.type === 'private') {
        div.innerHTML = `<em>خاص من ${msg.sender}:</em> ${msg.content} <em>(${msg.time})</em>`;
    }
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// حفظ الرسائل في LocalStorage (مؤقت)
function saveMessage(msg) {
    let msgs = JSON.parse(localStorage.getItem('messages')) || [];
    msgs.push(msg);
    localStorage.setItem('messages', JSON.stringify(msgs));
}

// تحميل الرسائل القديمة
function loadMessages() {
    messagesDiv.innerHTML = '';
    const msgs = JSON.parse(localStorage.getItem('messages')) || [];
    msgs.forEach(msg => {
        displayMessage(msg);
    });
}

// إرسال رسالة خاصة
function sendPrivateMessage(targetUser) {
    const content = prompt('اكتب رسالتك الخاصة ل ' + targetUser);
    if (content) {
        const msg = {
            sender: currentUser.username,
            content: content,
            time: new Date().toLocaleTimeString(),
            type: 'private',
            recipient: targetUser
        };
        saveMessage(msg);
        displayMessage(msg);
    }
}

// تسجيل خروج
document.getElementById('leave-chat').onclick = () => {
    // إزالة من القائمة
    members = members.filter(m => m !== currentUser.username);
    updateMembers();
    // مسح البيانات
    localStorage.removeItem('currentUser');
    currentUser = null;
    // إخفاء واجهة الشات
    document.getElementById('chat-section').style.display = 'none';
    document.getElementById('show-login').style.display = 'inline';
    document.getElementById('logout').style.display = 'none';
    messagesDiv.innerHTML = '';
}