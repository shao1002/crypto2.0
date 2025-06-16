document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const initialFunds = document.getElementById('initialFunds').value;

  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, initialFunds })
  });
  const data = await response.json();
  alert(data.message || data.error); // 顯示回饋
  if (data.message === '註冊成功') {
    window.location.href = '/login.html'; // 成功後跳轉
  }
});