const urlParams = new URLSearchParams(window.location.search);
const coinId = urlParams.get('coin_id');
const coinNameMap = { 2: 'BTC', 3: 'ETH', 4: 'BNB', 5: 'ADA', 6: 'XRP' };

document.getElementById('coinName').textContent = coinNameMap[coinId] || '未知幣種';

async function updatePrice() {
  const response = await fetch(`/api/coins?coin_id=${coinId}`);
  const coins = await response.json();
  const coin = coins.find(c => c.coin_id == coinId);
  if (coin) {
    document.getElementById('coinPrice').textContent = `${coin.current_price.toFixed(2)} USD`;
    document.getElementById('coinChange').textContent = `${coin.change_24h.toFixed(2)}%`;
    document.getElementById('coinChange').className = coin.change_24h >= 0 ? 'text-success' : 'text-danger';
  }
}

async function loadChart(timeframe) {
  let limit = 100;
  if (timeframe === '1h') limit = 60;
  else if (timeframe === '1d') limit = 1440;
  else if (timeframe === '1w') limit = 10080;
  else if (timeframe === '1m') limit = 43200;

  const response = await fetch(`/api/price_history/${coinId}?limit=${limit}`);
  const data = await response.json();
  const ctx = document.getElementById('priceChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.map(d => d.timestamp),
      datasets: [{
        label: '價格 (USD)',
        data: data.map(d => d.price),
        borderColor: 'blue',
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: { x: { display: false } }
    }
  });
}

let chart;
function changeTimeframe(timeframe) {
  if (chart) chart.destroy();
  loadChart(timeframe);
}

updatePrice();
setInterval(updatePrice, 5000);
loadChart('1d');