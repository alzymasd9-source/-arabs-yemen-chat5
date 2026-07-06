const API_URL = 'http://localhost:3000/api';

// دخول زائر
document.getElementById('visitorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = document.getElementById('visitorName').value;
  const gender = document.querySelector('input[name="gender"]:checked').value;

  try {
    const response = await fetch(`${API_URL}/auth/visitor-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, gender })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/rooms';
    } else {
      alert(data.message || 'حدث خطأ');
    }
  } catch (error) {
    console.error(error);
    alert('خطأ في الاتصال');
  }
});

// دخول عضو
document.getElementById('memberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('memberUsername').value;
  const password = document.getElementById('memberPassword').value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/rooms';
    } else {
      alert(data.message || 'بيانات دخول غير صحيحة');
    }
  } catch (error) {
    console.error(error);
    alert('خطأ في الاتصال');
  }
});

// تسجيل عضوية جديدة
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('regUsername').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/rooms';
    } else {
      alert(data.message || 'حدث خطأ في التسجيل');
    }
  } catch (error) {
    console.error(error);
    alert('خطأ في الاتصال');
  }
});
