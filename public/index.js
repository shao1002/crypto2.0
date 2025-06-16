async function loadCoins() {
  const response = await fetch('/api/coins');
  const coins = await response.json();
  const tbody = document.querySelector('#coinTable tbody');
  tbody.innerHTML = '';
  coins.forEach(coin => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${coin.symbol}</td>
      <td>${coin.current_price.toFixed(2)}</td>
      <td class="${coin.change_24h >= 0 ? 'text-success' : 'text-danger'}">${coin.change_24h.toFixed(2)}%</td>
      <td><a href="/coin.html?coin_id=${coin.coin_id}">查看</a></td>
    `;
    tbody.appendChild(row);
  });
}

document.getElementById('logout').addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
});

if (!localStorage.getItem('token')) {
  window.location.href = '/login.html'; // 未登入時重定向
} else {
  document.getElementById('logout').style.display = 'inline';
}

loadCoins();
setInterval(loadCoins, 5000);