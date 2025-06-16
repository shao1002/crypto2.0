const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const Binance = require('node-binance-api');
require('dotenv').config();

const app = express();
const saltRounds = 10;
const DEFAULT_COIN_ID = 1;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

console.log('環境變數:', process.env.DB_HOST, process.env.DB_PASSWORD ? '****' : '未設定');

// 測試資料庫連線
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('資料庫連線失敗:', err.stack);
  else console.log('資料庫連線成功，當前時間:', res.rows[0].now);
});

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_API_KEY,
  APISECRET: process.env.BINANCE_SECRET_KEY
});

// 即時價格更新（每5秒）
setInterval(async () => {
  const coins = [
    { id: 2, symbol: 'BTCUSDT' },
    { id: 3, symbol: 'ETHUSDT' },
    { id: 4, symbol: 'BNBUSDT' },
    { id: 5, symbol: 'ADAUSDT' },
    { id: 6, symbol: 'XRPUSDT' }
  ];
  for (const coin of coins) {
    try {
      const ticker = await binance.prices(coin.symbol);
      const price = parseFloat(ticker[coin.symbol]);
      await pool.query('UPDATE coins SET current_price = $1 WHERE coin_id = $2', [price, coin.id]);
      await pool.query('INSERT INTO price_history (coin_id, timestamp, price) VALUES ($1, NOW(), $2)', [coin.id, price]);
    } catch (err) {
      console.error(`更新 ${coin.symbol} 價格失敗: ${err.message}`);
    }
  }
}, 5000);

// 公開 API：獲取幣種價格
app.get('/api/coins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coins');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 價格歷史，支持時間範圍
app.get('/api/price_history/:coin_id', async (req, res) => {
  const { coin_id } = req.params;
  const { range = '1H' } = req.query; // 預設 1 小時
  let query = 'SELECT timestamp, price FROM price_history WHERE coin_id = $1';
  let params = [coin_id];
  const now = new Date();
  switch (range) {
    case '1D': query += ' AND timestamp >= NOW() - INTERVAL \'1 day\' ORDER BY timestamp DESC LIMIT 100'; break;
    case '1W': query += ' AND timestamp >= NOW() - INTERVAL \'1 week\' ORDER BY timestamp DESC LIMIT 100'; break;
    default: query += ' AND timestamp >= NOW() - INTERVAL \'1 hour\' ORDER BY timestamp DESC LIMIT 100'; // 1H
  }
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 獲取所有用戶（後台用）
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT user_id, username, created_at FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 獲取用戶錢包
app.get('/api/users/:id/wallet', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT w.*, c.symbol FROM wallets w JOIN coins c ON w.coin_id = c.coin_id WHERE w.user_id = $1',
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 執行交易（移除 token 驗證）
app.post('/api/transactions', async (req, res) => {
  const { user_id, coin_id, type, amount } = req.body;
  console.log('Received transaction request:', { user_id, coin_id, type, amount });
  try {
    const coin = await pool.query('SELECT current_price FROM coins WHERE coin_id = $1', [coin_id]);
    if (coin.rows.length === 0) throw new Error('無效的幣種');
    const price = coin.rows[0].current_price;
    const total = amount * price;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (type === 'BUY') {
        const usdWallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND coin_id = $2', [user_id, DEFAULT_COIN_ID]);
        if (usdWallet.rows.length === 0 || usdWallet.rows[0].balance < total) throw new Error('USD餘額不足');
        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND coin_id = $3', [total, user_id, DEFAULT_COIN_ID]);
        await client.query(
          'INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id, coin_id) DO UPDATE SET balance = wallets.balance + $3',
          [user_id, coin_id, amount]
        );
      } else if (type === 'SELL') {
        const coinWallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND coin_id = $2', [user_id, coin_id]);
        if (coinWallet.rows.length === 0 || coinWallet.rows[0].balance < amount) throw new Error('幣種餘額不足');
        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND coin_id = $3', [amount, user_id, coin_id]);
        await client.query(
          'INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id, coin_id) DO UPDATE SET balance = wallets.balance + $3',
          [user_id, DEFAULT_COIN_ID, total]
        );
      }
      await client.query(
        'INSERT INTO transactions (user_id, coin_id, type, amount, price, timestamp) VALUES ($1, $2, $3, $4, $5, NOW())',
        [user_id, coin_id, type, amount, price]
      );
      await client.query('COMMIT');
      console.log('Transaction successful for user_id:', user_id);
      res.json({ message: '交易成功' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Transaction failed:', err.message);
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

// 註冊（保持公開）
app.post('/api/register', async (req, res) => {
  const { username, password, initialFunds } = req.body;
  console.log('收到註冊請求:', { username, initialFunds });
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, password, created_at) VALUES ($1, $2, NOW()) RETURNING user_id',
      [username, hashedPassword]
    );
    if (initialFunds) {
      await pool.query(
        'INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, $3)',
        [result.rows[0].user_id, DEFAULT_COIN_ID, initialFunds]
      );
    }
    res.status(201).json({ message: '註冊成功', user_id: result.rows[0].user_id });
  } catch (err) {
    console.error('註冊錯誤:', err.stack);
    res.status(500).json({ error: '註冊失敗' });
  }
});

// 登錄（保持公開，但移除 token）
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT user_id, username, password FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ message: '用戶名不存在' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ message: '登錄成功', user_id: user.user_id });
    } else {
      res.status(401).json({ message: '密碼錯誤' });
    }
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));