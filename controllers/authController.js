const db = require('../config/db');
const adminCode = '2021010555';

const getLoginPage = (req, res) => {
    res.render('pages/login', { title: 'Login' });
};

const getRegisterPage = (req, res) => {
    res.render('pages/register', { title: 'Register' });
};

const logoutAndGetHomePage = (req, res, next) => {
    req.session.destroy(err => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
};

const postLogin = async (req, res, next) => {
    const { username, password } = req.body;
    try {
        // account table에서 user가 입력한 정보와 일치하는 사용자를 찾는다.
        const [rows] = await db.query('SELECT * FROM accounts WHERE account_name = ? AND account_password = ?', [username, password]);
        const user = rows[0];
        // 일치하는 계정이 존재한다면 세션 정보를 넘기고, 없다면 에러 페이지로 이동한다. 
        if (user) {
            req.session.userId = user.account_id;
            req.session.username = user.account_name;
            req.session.role = user.account_role;
            res.redirect('/');
        } else {
            const err = new Error('Invalid username or password');
            return next(err);
        }
        
    } catch (err) {
        return next(err);
    }
};

const postRegister = async (req, res, next) => {
    const { username, password, role, admin_code: req_admin_code } = req.body;
    let connection; 

    try {
        connection = await db.pool.getConnection();
        await connection.beginTransaction();

        // 사용자 등록시 입력한 아이디가 테이블에 이미 존재하는 아이디인지 우선 확인한다.
        const [existingUsers] = await connection.query('SELECT * FROM accounts WHERE account_name = ?', [username]);

        // 있으면 에러 페이지로 이동시킴
        if (existingUsers.length > 0) {
            const err = new Error('Username already exists.');
            await connection.query('COMMIT');
            return next(err);
        }

        // 관리자로 등록하는 경우에는 adminCode를 올바르게 입력했는지 확인
        if (role === 'admin' && req_admin_code !== adminCode) {
            const err = new Error('The admin code is incorrect.');
            await connection.query('COMMIT');
            return next(err);
        }

        // 테이블에 해당 아이디, 패스워드, 롤 추가
        await connection.query(
            'INSERT INTO accounts (account_name, account_password, account_role) VALUES (?, ?, ?)', 
            [username, password, role]
        )
        await connection.commit();
        res.redirect('/login');
    } catch (err) {
        await connection.rollback();
        return next(err);
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
    getLoginPage,
    getRegisterPage,
    logoutAndGetHomePage,
    postLogin,
    postRegister,
};