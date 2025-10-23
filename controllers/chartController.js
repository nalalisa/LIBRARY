const db = require('../config/db');

const getChartsPage = async (req, res, next) => {
  let selectedCategoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

  try {
    // 전체 인기 서적 가져오기
    const [popularBooks] = await db.query(
      `
          SELECT 
              b.book_id,
              b.book_title AS title,
              b.book_author AS author,
              GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories,
              COUNT(DISTINCT l.loan_id) AS borrow_count
          FROM loans l
          JOIN bookcopies bc ON l.copy_id = bc.copy_id
          JOIN books b ON bc.book_id = b.book_id
          LEFT JOIN bookcategories bcg ON b.book_id = bcg.book_id
          LEFT JOIN categories c ON bcg.category_id = c.category_id
          WHERE l.loan_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
          GROUP BY b.book_id
          ORDER BY borrow_count DESC, b.book_title ASC;
        `
    );

    /* 전체 카테고리 목록 */
    const [categories] = await db.query(`
        SELECT category_id AS id, category_name AS name FROM categories ORDER BY name ASC;
      `);

      if (!selectedCategoryId && categories.length > 0) {
        selectedCategoryId = categories[0].id;
      }

    /* 선택된 카테고리의 인기 서적 */
    let popularBooksByCategory = {};
    if (selectedCategoryId) {
      const [categoryBooks] = await db.query(
        `
            SELECT 
                b.book_id,
                b.book_title AS title,
                b.book_author AS author,
                GROUP_CONCAT(DISTINCT c.category_name SEPARATOR ', ') AS categories,
                COUNT(l.loan_id) AS borrow_count
            FROM loans l
            JOIN bookcopies bc ON l.copy_id = bc.copy_id
            JOIN books b ON bc.book_id = b.book_id
            JOIN bookcategories bcg ON b.book_id = bcg.book_id
            JOIN categories c ON bcg.category_id = c.category_id
            WHERE l.loan_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
              AND c.category_id = ?
            GROUP BY b.book_id
            ORDER BY borrow_count DESC, b.book_title ASC;
          `,
        [selectedCategoryId]
      );

      // 선택된 카테고리 이름을 가져오기
      const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
      const selectedCategoryName = selectedCategory ? selectedCategory.name : 'Unknown';

      popularBooksByCategory[selectedCategoryName] = categoryBooks;
    } else {
      // 카테고리별 전체 차트를 생성
      const [categoryBooksAll] = await db.query(
        `
            SELECT 
                c.category_name AS category,
                b.book_id,
                b.book_title AS title,
                b.book_author AS author,
                GROUP_CONCAT(DISTINCT c2.category_name SEPARATOR ', ') AS categories,
                COUNT(l.loan_id) AS borrow_count
            FROM loans l
            JOIN bookcopies bc ON l.copy_id = bc.copy_id
            JOIN books b ON bc.book_id = b.book_id
            JOIN bookcategories bcg ON b.book_id = bcg.book_id
            JOIN categories c ON bcg.category_id = c.category_id
            LEFT JOIN bookcategories bcg2 ON b.book_id = bcg2.book_id
            LEFT JOIN categories c2 ON bcg2.category_id = c2.category_id
            WHERE l.loan_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
            GROUP BY c.category_id, b.book_id
            ORDER BY c.category_name ASC, borrow_count DESC;
          `
      );

      // 카테고리별 그룹화
      for (const row of categoryBooksAll) {
        if (!popularBooksByCategory[row.category]) {
          popularBooksByCategory[row.category] = [];
        }
        popularBooksByCategory[row.category].push({
          title: row.title,
          author: row.author,
          categories: row.categories,
          borrow_count: row.borrow_count,
        });
      }
    }

    /* 렌더링 */
    res.render('pages/charts', {
      title: 'Popular Books Chart',
      popularBooks,
      popularBooksByCategory,
      categories,
      selectedCategoryId,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getChartsPage,
};
