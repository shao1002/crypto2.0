document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const response = await fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('token', data.token); // 儲存 token
    window.location.href = '/trade.html'; // 改為跳轉到 trade.html
  } else {
    alert(data.message || '登錄失敗');
  }
});