const db = require('../config/db');

/**
 * 카테고리 목록 페이지
 */
const getCategoriesPage = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.category_id AS id,
        c.category_name AS name,
        COUNT(bc.book_id) AS book_count
      FROM categories c
      LEFT JOIN bookcategories bc ON c.category_id = bc.category_id
      GROUP BY c.category_id, c.category_name
      ORDER BY c.category_name ASC;
    `);

    res.render('pages/categories', {
      title: 'Category Management',
      categories: rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 카테고리 추가 기능
 */
const postAddCategory = async (req, res, next) => {
  const { category_name } = req.body;

  try {
    if (!category_name || category_name.trim() === '') {
      const err = new Error('Category name cannot be empty.');
      err.status = 400;
      throw err;
    }

    // 이미 존재하는지 확인
    const [exists] = await db.query(
      'SELECT category_id FROM categories WHERE category_name = ?',
      [category_name.trim()]
    );

    if (exists.length > 0) {
      // 중복 이름이면 에러 표시 대신 그냥 리디렉션
      console.log('Duplicate category ignored:', category_name);
      return res.redirect('/categories');
    }

    // 새 카테고리 추가
    await db.query('INSERT INTO categories (category_name) VALUES (?)', [category_name.trim()]);
    res.redirect('/categories');
  } catch (err) {
    next(err);
  }
};

/**
 * 카테고리 삭제 기능
 */
const postDeleteCategory = async (req, res, next) => {
  const categoryId = Number(req.params.id);

  try {
    // 연결된 책과의 관계 제거
    await db.query('DELETE FROM bookcategories WHERE category_id = ?', [categoryId]);

    // 카테고리 자체 삭제
    await db.query('DELETE FROM categories WHERE category_id = ?', [categoryId]);
    res.redirect('/categories');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCategoriesPage,
  postAddCategory,
  postDeleteCategory,
};
