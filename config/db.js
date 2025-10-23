const mysql = require('mysql2/promise');
require('dotenv').config();

// 커넥션 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306, // MySQL 기본 포트는 3306입니다.
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  query: (sql, params) => pool.query(sql, params),
  pool,
};