const db = require('../config/db');

// 리뷰 메인 페이지
const getReviewsPage = async (req, res, next) => {
  try {
    const [books] = await db.query(`
      SELECT 
        b.book_id AS id,
        b.book_title AS title,
        b.book_author AS author,
        GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories
      FROM books b
      LEFT JOIN bookcategories bcg ON b.book_id = bcg.book_id
      LEFT JOIN categories c ON bcg.category_id = c.category_id
      GROUP BY b.book_id
      ORDER BY b.book_title ASC;
    `);

    res.render('pages/reviews', {
      title: 'Book Reviews',
      books,
      userId: req.session.userId || null, // 로그인하지 않아도 null로 전달
    });
  } catch (err) {
    next(err);
  }
};

// 특정 책 리뷰 목록 (누구나 보기 가능)
const getBookReviews = async (req, res, next) => {
  const bookId = Number(req.params.id);
  try {
    const [reviews] = await db.query(
      `
      SELECT 
        r.review_id,
        r.account_id,
        a.account_name AS username,
        r.rating,
        r.comment
      FROM reviews r
      JOIN accounts a ON r.account_id = a.account_id
      WHERE r.book_id = ?
      ORDER BY r.review_id DESC;
      `,
      [bookId]
    );
    res.json(reviews);
  } catch (err) {
    next(err);
  }
};

// 리뷰 작성 (로그인 필요)
const postBookReview = async (req, res, next) => {
  const bookId = Number(req.params.id);
  const userId = req.session.userId;
  const { rating, comment } = req.body;

  if (!userId)
    return res.status(401).json({ message: 'Login required to post a review.' });

  try {
    await db.query(
      `INSERT INTO reviews (book_id, account_id, rating, comment)
       VALUES (?, ?, ?, ?)`,
      [bookId, userId, rating, comment]
    );
    res.redirect('/reviews');
  } catch (err) {
    next(err);
  }
};

// 리뷰 삭제 (로그인 필요)
const deleteBookReview = async (req, res, next) => {
  const bookId = Number(req.params.bookId);
  const reviewId = Number(req.params.reviewId);
  const userId = req.session.userId;

  if (!userId)
    return res.status(401).json({ message: 'Login required to delete a review.' });

  try {
    const [rows] = await db.query(
      'SELECT account_id FROM reviews WHERE review_id = ? AND book_id = ?',
      [reviewId, bookId]
    );
    if (!rows.length)
      return res.status(404).json({ message: 'Review not found.' });
    if (rows[0].account_id !== userId)
      return res.status(403).json({ message: 'Not authorized to delete this review.' });

    await db.query('DELETE FROM reviews WHERE review_id = ?', [reviewId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getReviewsPage,
  getBookReviews,
  postBookReview,
  deleteBookReview,
};
