DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS wallets CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS coins CASCADE;

CREATE TABLE coins (
    coin_id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    change_24h DECIMAL
);

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(coin_id),
    timestamp TIMESTAMP,
    price DECIMAL
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER REFERENCES coins(coin_id),
    balance DECIMAL(15, 2) NOT NULL,
    UNIQUE (user_id, coin_id)
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER REFERENCES coins(coin_id),
    type VARCHAR(4) CHECK (type IN ('BUY', 'SELL')),
    amount DECIMAL(15, 2) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

INSERT INTO coins (symbol, current_price, change_24h) VALUES
('USD', 1.00, 0.0),
('BTC', 60000.00, 2.5),
('ETH', 3000.00, 1.8),
('BNB', 500.00, 0.5),
('ADA', 1.20, -0.3),
('XRP', 0.50, 0.1);