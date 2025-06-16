let priceChart;

async function loadPriceChart(coinId, range) {
  const response = await fetch(`/api/price_history/${coinId}?range=${range}`);
  const data = await response.json();
  if (response.ok) {
    if (!priceChart) {
      const ctx = document.getElementById('priceChart').getContext('2d');
      priceChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.map(d => new Date(d.timestamp).toLocaleTimeString()),
          datasets: [{
            label: '價格走勢 (USD)',
            data: data.map(d => d.price),
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            fill: false
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { title: { display: true, text: '時間' } },
            y: { title: { display: true, text: '價格 (USD)' }, beginAtZero: false }
          }
        }
      });
    } else {
      priceChart.data.labels = data.map(d => new Date(d.timestamp).toLocaleTimeString());
      priceChart.data.datasets[0].data = data.map(d => d.price);
      priceChart.update();
    }
  } else {
    console.error('Failed to load price history:', data.message);
  }
}

document.getElementById('chartCoinSelect').addEventListener('change', (e) => {
  const range = document.getElementById('timeRange').value;
  loadPriceChart(e.target.value, range);
});

document.getElementById('timeRange').addEventListener('change', (e) => {
  const coinId = document.getElementById('chartCoinSelect').value;
  loadPriceChart(coinId, e.target.value);
});

document.getElementById('tradeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = 1; // 硬編碼用戶 ID 進行演示
  const coinId = document.getElementById('coinSelect').value;
  const type = document.getElementById('tradeType').value;
  const amount = document.getElementById('tradeAmount').value;
  console.log('Sending transaction request:', { user_id: userId, coin_id: coinId, type, amount });

  const response = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, coin_id: coinId, type, amount })
  });
  const data = await response.json();
  console.log('Response from server:', data);
  if (response.ok) {
    alert(data.message || '交易成功');
    loadPriceChart(coinId, document.getElementById('timeRange').value);
  } else {
    alert(data.message || '交易失敗');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const coinId = document.getElementById('chartCoinSelect').value;
  const range = document.getElementById('timeRange').value;
  loadPriceChart(coinId, range);
  setInterval(() => loadPriceChart(coinId, range), 10000); // 每 10 秒刷新
});