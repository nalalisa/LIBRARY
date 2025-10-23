const db = require('../config/db');

const initDB = async () => {
  try {
    console.log('Deleting existing tables...');
    await db.query('SET FOREIGN_KEY_CHECKS = 0;');
    await db.query('DROP TABLE IF EXISTS reviews;');
    await db.query('DROP TABLE IF EXISTS loans;');
    await db.query('DROP TABLE IF EXISTS bookcategories;');
    await db.query('DROP TABLE IF EXISTS bookcopies;');
    await db.query('DROP TABLE IF EXISTS categories;');
    await db.query('DROP TABLE IF EXISTS books;');
    await db.query('DROP TABLE IF EXISTS accounts;');
    await db.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('Creating new tables...');

    // accounts
    await db.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        account_id INT NOT NULL AUTO_INCREMENT,
        account_name VARCHAR(50) NOT NULL UNIQUE,
        account_password VARCHAR(50) NOT NULL,
        account_role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
        PRIMARY KEY (account_id)
      );
    `);

    // books
    await db.query(`
      CREATE TABLE IF NOT EXISTS books (
        book_id INT NOT NULL AUTO_INCREMENT,
        book_title VARCHAR(255) NOT NULL,
        book_author VARCHAR(100) NOT NULL,
        PRIMARY KEY (book_id)
      );
    `);

    // categories
    await db.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id INT NOT NULL AUTO_INCREMENT,
        category_name VARCHAR(50) NOT NULL UNIQUE,
        PRIMARY KEY (category_id)
      );
    `);

    // bookcopies
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookcopies (
        copy_id INT NOT NULL AUTO_INCREMENT,
        book_id INT NOT NULL,
        status ENUM('available', 'on_loan') NOT NULL DEFAULT 'available',
        PRIMARY KEY (copy_id),
        CONSTRAINT fk_bookcopies_books
          FOREIGN KEY (book_id)
          REFERENCES books (book_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      );
    `);

    // loans
    await db.query(`
      CREATE TABLE IF NOT EXISTS loans (
        loan_id INT NOT NULL AUTO_INCREMENT,
        copy_id INT NOT NULL,
        account_id INT NOT NULL,
        loan_date DATE NOT NULL,
        due_date DATE NOT NULL,
        return_date DATE NULL,
        PRIMARY KEY (loan_id),
        CONSTRAINT fk_loans_bookcopies
          FOREIGN KEY (copy_id)
          REFERENCES bookcopies (copy_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT fk_loans_accounts
          FOREIGN KEY (account_id)
          REFERENCES accounts (account_id)
          ON DELETE NO ACTION 
          ON UPDATE NO ACTION
      );
    `);

    // reviews
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        review_id INT NOT NULL AUTO_INCREMENT,
        book_id INT NOT NULL,
        account_id INT NOT NULL,
        rating SMALLINT NOT NULL,
        comment TEXT NULL,
        PRIMARY KEY (review_id),
        CONSTRAINT fk_reviews_books
          FOREIGN KEY (book_id)
          REFERENCES books (book_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT fk_reviews_accounts
          FOREIGN KEY (account_id)
          REFERENCES accounts (account_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION 
      );
    `);

    // bookcategories
    await db.query(`
      CREATE TABLE IF NOT EXISTS bookcategories (
        book_id INT NOT NULL,
        category_id INT NOT NULL,
        PRIMARY KEY (book_id, category_id),
        CONSTRAINT fk_bookcategories_books
          FOREIGN KEY (book_id)
          REFERENCES books (book_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
        CONSTRAINT fk_bookcategories_categories
          FOREIGN KEY (category_id)
          REFERENCES categories (category_id)
          ON DELETE CASCADE
          ON UPDATE NO ACTION
      );
    `);

    console.log('Database initialization completed successfully.');
  } catch (err) {
    console.error('Database initialization failed:', err);
  } finally {
    db.pool.end();
  }
};

initDB();
