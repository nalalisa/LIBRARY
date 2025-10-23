const db = require('../config/db');

const getBooksPage = async (req, res, next) => {
  const { query: searchQuery, searchBy } = req.query;
  const sortedByWithDefault = req.query.sortBy || 'title';
  const sortOrderWithDefault = req.query.sortOrder || 'asc';

  try {
    let whereClause = '';
    let havingClause = '';
    const params = [];

    // 검색 조건 설정 -> 조건에 따라서 where 절을 다르게 생성한다.
    if (searchQuery && searchBy) {
      if (searchBy === 'title') {
        whereClause = 'WHERE b.book_title LIKE ?';
        params.push(`%${searchQuery}%`);
      } else if (searchBy === 'author') {
        whereClause = 'WHERE b.book_author LIKE ?';
        params.push(`%${searchQuery}%`);
      } else if (searchBy === 'category') {
        // 카테고리는 GROUP_CONCAT 필드 기반이므로 HAVING 사용
        havingClause = 'HAVING categories LIKE ?';
        params.push(`%${searchQuery}%`);
      }
    }


    // 정렬 기준 설정. 조건에 맞춰서 order by 의 기준 속성을 정해준다.
    let orderByClause = '';
    if (sortedByWithDefault === 'author') orderByClause = 'ORDER BY b.book_author';
    else if (sortedByWithDefault === 'categories') {
      // SQL 쿼리에서 SELECT 한 별칭 'categories'를 기준으로 정렬
      orderByClause = 'ORDER BY categories';
    } else {
        // 기본값은 'title'
        orderByClause = 'ORDER BY b.book_title';
    }
    orderByClause += ` ${sortOrderWithDefault}`;

    // 메인 쿼리를 검색, 정렬 조건들에 따라 생성한다.
    const query = `
      SELECT 
          b.book_id AS id,
          b.book_title AS title,
          b.book_author AS author,
          cat.categories,
          IFNULL(cnt.total_quantity, 0) AS total_quantity,
          IFNULL(cnt.available_quantity, 0) AS available_quantity
      FROM books b
      LEFT JOIN (
          SELECT 
              bc.book_id,
              COUNT(*) AS total_quantity,
              SUM(CASE WHEN bc.status = 'available' THEN 1 ELSE 0 END) AS available_quantity
          FROM bookcopies bc
          GROUP BY bc.book_id
      ) cnt ON cnt.book_id = b.book_id
      LEFT JOIN (
          SELECT 
              bcg.book_id,
              GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories
          FROM bookcategories bcg
          JOIN categories c ON bcg.category_id = c.category_id
          GROUP BY bcg.book_id
      ) cat ON cat.book_id = b.book_id
      ${whereClause}
      GROUP BY b.book_id, b.book_title, b.book_author, cat.categories
      ${havingClause}
      ${orderByClause};
    `;

    const [rows] = await db.query(query, params);

    res.render('pages/books', {
      title: 'All Books',
      books: rows,
      sortBy: sortedByWithDefault,
      sortOrder: sortOrderWithDefault,
      query: searchQuery,
      searchBy: searchBy,
    });
  } catch (err) {
    next(err);
  }
};

const getAddBookPage = async (req, res, next) => {
  try {
    // 책을 추가할 떄 검색 카테고리와 저자를 선택할 수 있도록 한다.
    const [categories] = await db.query(
      'SELECT category_id AS id, category_name AS name FROM categories'
    );
    const [authors] = await db.query('SELECT DISTINCT book_author AS name FROM books');

    res.render('pages/add-book', {
      title: 'Add New Book',
      categories,
      authors,
    });
  } catch (err) {
    next(err);
  }
};

const postAddBook = async (req, res, next) => {
  const { title, author, quantity, categories } = req.body;
  const connection = await db.pool.getConnection();

  try {
    await connection.beginTransaction();

    // author를 선택한 경우와 직접 입력한 경우 처리
    const [bookInsert] = await connection.query(
      'INSERT INTO books (book_title, book_author) VALUES (?, ?)',
      [title, author.startsWith('name:') ? author.split(':')[1] : author]
    );
    const newBookId = bookInsert.insertId;

    // 카테고리 직접 입력한 경우와 선택한 경우 처리. 하나의 책은 여러 카테고리를 가질 수 있기 때문에 카테고리 배열의 각 카테고리마다 처리해줘야함.
    if (categories && categories.length > 0) {
      const categoryList = Array.isArray(categories) ? categories : [categories];
      for (const cat of categoryList) {
        let categoryId = null;
        if (cat.startsWith('id:')) {
          categoryId = Number(cat.split(':')[1]);
        } else {
          // 카테고리가 이미 존재하는 카테고리인지 확인한다.
          const [existing] = await connection.query(
            'SELECT category_id FROM categories WHERE category_name = ?',
            [cat]
          );
          // 존재하는 경우 카테고리 아이디만 설정
          if (existing.length > 0) categoryId = existing[0].category_id;
          // 새로 추가된 경우 카테고리 테이블에 새로 insert
          else {
            const [insertCat] = await connection.query(
              'INSERT INTO categories (category_name) VALUES (?)',
              [cat]
            );
            categoryId = insertCat.insertId;
          }
        }
        // 서적과 카테고리 간 연결관계 만들어줌
        await connection.query(
          'INSERT INTO bookcategories (book_id, category_id) VALUES (?, ?)',
          [newBookId, categoryId]
        );
      }
    }

    // 수량에 대한 처리. 입력 수량만큼 bookcopy를 생성한다.
    const count = Number(quantity) || 1;
    for (let i = 0; i < count; i++) {
      await connection.query('INSERT INTO bookcopies (book_id, status) VALUES (?, "available")', [
        newBookId,
      ]);
    }

    await connection.commit();
    res.redirect('/books');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const postDeleteBookInstance = async (req, res, next) => {
  const copyId = Number(req.params.id);
  try {
    const [bookRow] = await db.query('SELECT book_id FROM bookcopies WHERE copy_id = ?', [copyId]);
    if (!bookRow.length) return res.redirect('/books');
    const bookId = bookRow[0].book_id;

    // 삭제하고자 하는 copy본의 id를 통해 삭제함
    await db.query('DELETE FROM bookcopies WHERE copy_id = ?', [copyId]);

    // 모든 copy가 다 삭제된 경우 서적을 삭제한다.
    const [remaining] = await db.query('SELECT COUNT(*) AS cnt FROM bookcopies WHERE book_id = ?', [
      bookId,
    ]);
    if (remaining[0].cnt === 0) {
      await db.query('DELETE FROM books WHERE book_id = ?', [bookId]);
    }
    res.redirect('/books');
  } catch (err) {
    next(err);
  }
};

const postBorrowBook = async (req, res, next) => {
  const copyId = Number(req.params.id);
  const userId = req.session.userId;
  if (!userId) return res.redirect('/login');

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [cntRows] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM loans WHERE account_id = ? AND return_date IS NULL',
      [userId]
    );
    if (cntRows[0].cnt >= 3) {
      const err = new Error('You have reached the maximum borrowing limit (3 books).');
      err.status = 400;
      throw err;
    }

    const [overdueRows] = await connection.query(
      `SELECT loan_id FROM loans WHERE account_id = ? AND return_date IS NULL AND due_date < CURDATE()`,
      [userId]
    );
    if (overdueRows.length > 0) {
      const err = new Error('You cannot borrow new books while you have overdue loans.');
      err.status = 400;
      throw err;
    }

    const [bookRows] = await connection.query('SELECT book_id FROM bookcopies WHERE copy_id = ?', [
      copyId,
    ]);
    const bookId = bookRows[0]?.book_id;

    const [sameBookLoans] = await connection.query(
      `SELECT l.loan_id FROM loans l JOIN bookcopies bc ON l.copy_id = bc.copy_id 
       WHERE l.account_id = ? AND bc.book_id = ? AND l.return_date IS NULL`,
      [userId, bookId]
    );
    if (sameBookLoans.length > 0) {
      const err = new Error('You already borrowed another copy of this book.');
      err.status = 400;
      throw err;
    }

    const [copies] = await connection.query(
      'SELECT status FROM bookcopies WHERE copy_id = ? FOR UPDATE',
      [copyId]
    );
    if (!copies.length || copies[0].status !== 'available') {
      const err = new Error('This copy is not available.');
      err.status = 400;
      throw err;
    }

    const today = new Date();
    const due = new Date();
    due.setDate(today.getDate() + 7);

    await connection.query(
      'INSERT INTO loans (copy_id, account_id, loan_date, due_date) VALUES (?, ?, ?, ?)',
      [copyId, userId, today, due]
    );
    await connection.query('UPDATE bookcopies SET status = "on_loan" WHERE copy_id = ?', [copyId]);

    await connection.commit();
    res.redirect('/books');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const postReturnBook = async (req, res, next) => {
  const loanId = Number(req.params.id);
  const userId = req.session.userId;
  if (!userId) return res.redirect('/login');

  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const [loanRows] = await connection.query(
      'SELECT copy_id FROM loans WHERE loan_id = ? AND account_id = ? AND return_date IS NULL',
      [loanId, userId]
    );
    if (!loanRows.length) {
      const err = new Error('You cannot return this book (invalid or not yours).');
      err.status = 400;
      throw err;
    }

    const copyId = loanRows[0].copy_id;
    const today = new Date();
    await connection.query('UPDATE loans SET return_date = ? WHERE loan_id = ?', [today, loanId]);
    await connection.query('UPDATE bookcopies SET status = "available" WHERE copy_id = ?', [
      copyId,
    ]);

    await connection.commit();
    res.redirect('/borrowings');
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const getBookInstances = async (req, res, next) => {
  const bookId = Number(req.params.id);
  try {
    const [rows] = await db.query(
      `
      SELECT 
        bc.copy_id AS id,
        bc.book_id,
        l.loan_id AS borrowing_id,
        a.account_id AS borrowed_by_id,
        a.account_name AS borrowed_by,
        DATE_FORMAT(l.loan_date, '%Y-%m-%d') AS borrow_date,
        bc.status
      FROM bookcopies bc
      LEFT JOIN loans l ON bc.copy_id = l.copy_id AND l.return_date IS NULL
      LEFT JOIN accounts a ON l.account_id = a.account_id
      WHERE bc.book_id = ?;
      `,
      [bookId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBooksPage,
  getAddBookPage,
  postAddBook,
  postDeleteBookInstance,
  postBorrowBook,
  postReturnBook,
  getBookInstances,
};
