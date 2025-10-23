const db = require('../config/db');

const getUsersPage = async (req, res, next) => {
  const { searchBy, query } = req.query;

  try {
    let sql = `
      SELECT 
        account_id AS id,
        account_name AS username,
        account_role AS role
      FROM accounts
    `;
    const params = [];

    // 검색 조건 처리
    if (query && searchBy) {
      if (searchBy === 'username') {
        sql += ' WHERE account_name LIKE ?';
        params.push(`%${query}%`);
      } else if (searchBy === 'role') {
        sql += ' WHERE account_role = ?';
        params.push(query);
      }
    }

    sql += ' ORDER BY account_role DESC, account_name ASC;';

    const [rows] = await db.query(sql, params);

    // 결과 렌더링
    res.render('pages/users', {
      title: 'User Management',
      users: rows,
      searchBy,
      query,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsersPage,
};
