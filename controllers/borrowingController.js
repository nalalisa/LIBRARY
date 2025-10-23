const db = require('../config/db');

const getBorrowingsPage = async (req, res, next) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect('/login');
  }
  try {
    // 해당 유저의 대출 기록 가져오기
    const [rows] = await db.query(
      `
              SELECT 
                  l.loan_id AS id,
                  bc.copy_id AS book_instance_id,
                  b.book_title,
                  b.book_author,
                  DATE_FORMAT(l.loan_date, '%Y-%m-%d') AS borrow_date,
                  DATE_FORMAT(l.due_date, '%Y-%m-%d') AS due_date,
                  DATE_FORMAT(l.return_date, '%Y-%m-%d') AS return_date,
                  CASE
                      WHEN l.return_date IS NULL THEN 'borrowed'
                      ELSE 'returned'
                  END AS status
              FROM loans l
              JOIN bookcopies bc ON l.copy_id = bc.copy_id
              JOIN books b ON bc.book_id = b.book_id
              WHERE l.account_id = ?
              ORDER BY l.loan_date DESC
            `,
      [userId]
    );

    // 페이지 렌더링
    res.render('pages/borrowings', {
      title: 'My Borrowing History',
      borrowings: rows,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBorrowingsPage,
};
