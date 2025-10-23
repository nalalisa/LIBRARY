const db = require('../config/db');

/**
 * 관리자용 연체 도서 통계 페이지
 * - 현재 대출 중인 도서 중 연체 도서의 비율을 계산
 */
const getOverdueStatsPage = async (req, res, next) => {
  try {
    // 현재 대출 중(return_date IS NULL)인 모든 대출 건수
    const [[{ total_loans }]] = await db.query(`
      SELECT COUNT(*) AS total_loans
      FROM loans
      WHERE return_date IS NULL;
    `);

    // 연체 도서 건수 (due_date < 오늘)
    const [[{ overdue_loans }]] = await db.query(`
      SELECT COUNT(*) AS overdue_loans
      FROM loans
      WHERE return_date IS NULL
        AND due_date < CURDATE();
    `);

    const overdueRate =
      total_loans > 0 ? ((overdue_loans / total_loans) * 100).toFixed(1) : 0;

    // 연체된 책의 상세 리스트 (관리자가 확인할 수 있도록)
    const [overdueList] = await db.query(`
      SELECT 
        l.loan_id,
        b.book_title,
        b.book_author,
        a.account_name AS borrower,
        DATE_FORMAT(l.loan_date, '%Y-%m-%d') AS loan_date,
        DATE_FORMAT(l.due_date, '%Y-%m-%d') AS due_date
      FROM loans l
      JOIN bookcopies bc ON l.copy_id = bc.copy_id
      JOIN books b ON bc.book_id = b.book_id
      JOIN accounts a ON l.account_id = a.account_id
      WHERE l.return_date IS NULL
        AND l.due_date < CURDATE()
      ORDER BY l.due_date ASC;
    `);

    res.render('pages/overdue-stats', {
      title: 'Overdue Book Statistics',
      totalLoans: total_loans,
      overdueLoans: overdue_loans,
      overdueRate,
      overdueList,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverdueStatsPage,
};
