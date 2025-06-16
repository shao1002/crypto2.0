const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const app = express();

const saltRounds = 10;
const DEFAULT_COIN_ID = 0;
const PUBLIC_DIR = 'public';

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// 註冊
app.post('/api/users/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashedPassword]
    );
    const userId = result.rows[0].user_id;
    await pool.query('INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, 1000)', [userId, DEFAULT_COIN_ID]);
    res.status(201).json({ message: '註冊成功' });
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ message: '用戶名已存在' });
    } else {
      res.status(500).json({ message: '伺服器錯誤', error: err.message });
    }
  }
});

// 登錄
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT user_id, username, password FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: '用戶名不存在' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ user_id: user.user_id, username: user.username });
    } else {
      res.status(401).json({ message: '密碼錯誤' });
    }
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
});

// 執行交易
app.post('/api/transactions', async (req, res) => {
  const { user_id, coin_id, type, amount } = req.body;
  try {
    const coin = await pool.query('SELECT current_price FROM coins WHERE coin_id = $1', [coin_id]);
    const price = coin.rows[0].current_price;
    const total = amount * price;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (type === 'BUY') {
        const usdWallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND coin_id = $2', [user_id, DEFAULT_COIN_ID]);
        if (usdWallet.rows[0].balance < total) throw new Error('餘額不足');
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
      res.json({ message: '交易成功' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const PORT = 3000; // 本地使用固定端口
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));