const db = require('../config/db');

/**
 * 개인별 독서 통계 페이지
 * - 로그인한 사용자의 loans 테이블을 기준으로
 * - category_name 별 대출 횟수를 집계
 */
const getUserStatsPage = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) return res.redirect('/login');

  try {
    // 카테고리별 대출 횟수 집계
    const [rows] = await db.query(
      `
      SELECT 
        c.category_name AS category,
        COUNT(*) AS borrow_count
      FROM loans l
      JOIN bookcopies bc ON l.copy_id = bc.copy_id
      JOIN books b ON bc.book_id = b.book_id
      JOIN bookcategories bcg ON b.book_id = bcg.book_id
      JOIN categories c ON bcg.category_id = c.category_id
      WHERE l.account_id = ?
      GROUP BY c.category_id
      ORDER BY borrow_count DESC;
      `,
      [userId]
    );

    // 총 대출 건수 및 비율 계산
    const totalBorrowed = rows.reduce((sum, row) => sum + row.borrow_count, 0);
    const stats = rows.map((row, i) => ({
      rank: i + 1,
      category: row.category,
      borrow_count: row.borrow_count,
      ratio:
        totalBorrowed > 0
          ? ((row.borrow_count / totalBorrowed) * 100).toFixed(1)
          : 0,
    }));

    res.render('pages/my-stats', {
      title: 'My Reading Statistics',
      stats,
      totalBorrowed,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUserStatsPage,
};
