import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { Sequelize, DataTypes } from 'sequelize';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure folders
['../uploads', '../covers', '../data', '../views', '../public/css', '../public/js', '../public/admin'].forEach(d => {
  fs.mkdirSync(path.join(__dirname, d), { recursive: true });
});

// Middleware
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'littleBraynSecret2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', 'data', 'littlebrayn.sqlite'),
  logging: false
});

// Models
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(255), allowNull: false },
  role: { type: DataTypes.STRING(20), defaultValue: 'admin' }
}, { tableName: 'users', timestamps: false });

const Book = sequelize.define('Book', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  author: { type: DataTypes.STRING(255), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  genre: { type: DataTypes.STRING(100), allowNull: true },
  coverUrl: { type: DataTypes.STRING(500), allowNull: true },
  filePath: { type: DataTypes.STRING(500), allowNull: true },
  originalFilename: { type: DataTypes.STRING(255), allowNull: true },
  featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  newRelease: { type: DataTypes.BOOLEAN, defaultValue: false },
  pageCount: { type: DataTypes.INTEGER, allowNull: true },
  contentSnapshot: { type: DataTypes.TEXT, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: true }
}, { tableName: 'books', timestamps: false });

const ReadingProgress = sequelize.define('ReadingProgress', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bookId: { type: DataTypes.INTEGER, allowNull: false },
  sessionKey: { type: DataTypes.STRING(255), allowNull: false },
  page: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'reading_progress', timestamps: false });

User.hasMany(Book, { foreignKey: 'userId' });
Book.belongsTo(User, { foreignKey: 'userId' });

// Upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = file.fieldname === 'cover' ? 'covers' : 'uploads';
    const dir = path.join(__dirname, '..', sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'cover') {
      if (!file.mimetype.startsWith('image/')) return cb(new Error('Invalid cover file'));
      return cb(null, true);
    }
    if (file.fieldname === 'pdf') {
      if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
        return cb(new Error('Only PDF allowed'));
      }
      return cb(null, true);
    }
    return cb(new Error('Unsupported field'));
  }
});

const requireAdmin = (req, res, next) => {
  if (!req.session.isAdmin) {
    const wantsHtml = String(req.headers.accept || '').includes('text/html');
    if (wantsHtml) return res.redirect('/admin/login');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Routes
app.get('/api/test', (req, res) => res.json({ message: 'API is working', timestamp: Date.now() }));

app.get('/api/books', async (req, res) => {
  try {
    const { q, genre, featured, newRelease } = req.query;
    const where = {};
    if (q) {
      const term = String(q).trim();
      where[Sequelize.Op.or] = [
        { title: { [Sequelize.Op.like]: `%${term}%` } },
        { author: { [Sequelize.Op.like]: `%${term}%` } },
        { genre: { [Sequelize.Op.like]: `%${term}%` } }
      ];
    }
    if (genre) where.genre = { [Sequelize.Op.like]: `%${genre}%` };
    if (featured === 'true') where.featured = true;
    if (newRelease === 'true') where.newRelease = true;
    const books = await Book.findAll({ where, order: [['id', 'DESC']] });
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/featured', async (req, res) => {
  try {
    const books = await Book.findAll({ where: { featured: true }, order: [['id', 'DESC']] });
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/new-releases', async (req, res) => {
  try {
    const books = await Book.findAll({ where: { newRelease: true }, order: [['id', 'DESC']] });
    res.json({ books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id', async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/books/:id/download', async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book || !book.filePath) return res.status(404).json({ error: 'File not found' });
    const filePath = path.join(__dirname, '..', book.filePath);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.download(filePath, book.title.replace(/[^a-z0-9]/gi, '_') + '.pdf');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/reader/progress/:bookId', async (req, res) => {
  try {
    const bookId = Number(req.params.bookId);
    const sessionKey = req.sessionID || 'anonymous';
    let progress = await ReadingProgress.findOne({ where: { bookId, sessionKey } });
    res.json({ page: progress ? progress.page : 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reader/progress/:bookId', async (req, res) => {
  try {
    const bookId = Number(req.params.bookId);
    const page = Math.max(1, Number(req.body.page || 1));
    const sessionKey = req.sessionID || 'anonymous';
    await ReadingProgress.upsert({ bookId, sessionKey, page });
    res.json({ saved: true, page });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    req.session.isAdmin = true;
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        console.error('session save failed', err);
        return res.status(500).json({ error: 'session failed' });
      }
      res.json({ success: true, user: { id: user.id, username: user.username } });
    });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/auth/check', (req, res) => {
  res.json({
    isAdmin: !!req.session?.isAdmin,
    sessionId: req.sessionID,
    hasSessionCookie: !!req.headers.cookie,
    cookiePreview: req.headers.cookie ? String(req.headers.cookie).slice(0, 80) : null
  });
});

app.post('/api/upload/file', requireAdmin, upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'pdf', maxCount: 1 }
]), async (req, res) => {
  try {
    const results = {};
    if (req.files?.cover?.[0]) results.coverUrl = '/covers/' + req.files.cover[0].filename;
    if (req.files?.pdf?.[0]) results.pdfPath = '/uploads/' + req.files.pdf[0].filename;
    const bookId = Number(req.body.bookId);
    if (bookId) {
      const book = await Book.findByPk(bookId);
      if (!book) return res.status(404).json({ error: 'Book not found' });
      const update = {};
      if (results.coverUrl) update.coverUrl = results.coverUrl;
      if (results.pdfPath) update.filePath = results.pdfPath;
      await book.update(update);
      results.bookId = bookId;
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/books', requireAdmin, async (req, res) => {
  try {
    const book = await Book.create(req.body);
    res.status(201).json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/books/:id', requireAdmin, async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    await book.update(req.body);
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/books/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Book.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Book not found' });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use('/covers', express.static(path.join(__dirname, 'covers')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}

app.get('/admin/login', noCache, (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin-login.html')));
app.get('/admin/dashboard', noCache, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin-dashboard.html')));
app.get('/admin', noCache, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin-dashboard.html')));
app.get('/admin/upload', noCache, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'admin-upload.html')));
app.get('/reader.html', noCache, (req, res) => res.sendFile(path.join(__dirname, '..', 'views', 'reader.html')));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    const userCount = await User.count();
    if (userCount === 0) {
      await User.create({ username: process.env.ADMIN_USERNAME || 'admin', passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10), role: 'admin' });
      console.log('Seeded admin user');
    } else {
      console.log(`Users already exist: ${userCount}`);
    }

    const demoCount = await Book.count();
    if (demoCount === 0) {
      const demos = [
        { title: 'The Art of Programming', author: 'Donald Knuth', description: 'A comprehensive guide to computer programming fundamentals and best practices.', genre: 'Technology', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%231a2a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="24" x="100" y="150" text-anchor="middle"%3EThe Art of%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="24" x="100" y="185" text-anchor="middle"%3EProgramming%3C/text%3E%3C/svg%3E', featured: true, newRelease: false, pageCount: 450 },
        { title: 'Mystery of the Ancient Temple', author: 'Sarah Johnson', description: 'A thrilling adventure through hidden temples and ancient secrets.', genre: 'Adventure', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%232d4a3e" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="20" x="100" y="140" text-anchor="middle"%3EMystery of the%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="20" x="100" y="165" text-anchor="middle"%3EAncient Temple%3C/text%3E%3C/svg%3E', featured: true, newRelease: true, pageCount: 320 },
        { title: 'Digital Marketing Mastery', author: 'John Williams', description: 'Learn modern digital marketing strategies from industry experts.', genre: 'Business', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%234a3a2a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="140" text-anchor="middle"%3EDigital Marketing%3C/text%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="165" text-anchor="middle"%3EMastery%3C/text%3E%3C/svg%3E', featured: false, newRelease: true, pageCount: 280 },
        { title: 'Poetry of the Soul', author: 'Emily Dickinson', description: 'A collection of profound and beautiful poetry that touches the heart.', genre: 'Poetry', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%233a2a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="22" x="100" y="140" text-anchor="middle"%3EPoetry of%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="22" x="100" y="165" text-anchor="middle"%3Ethe Soul%3C/text%3E%3C/svg%3E', featured: true, newRelease: false, pageCount: 195 },
        { title: 'Science Explained', author: 'Carl Sagan', description: 'An accessible introduction to complex scientific concepts.', genre: 'Science', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%232a3a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="140" text-anchor="middle"%3EScience%3C/text%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="165" text-anchor="middle"%3EExplained%3C/text%3E%3C/svg%3E', featured: false, newRelease: false, pageCount: 512 }
      ];
      await Book.bulkCreate(demos);
      console.log(`Seeded ${demos.length} demo books`);
    } else {
      console.log(`Books already exist: ${demoCount}`);
    }

    app.listen(PORT, () => console.log(`littleBrayn running on http://localhost:${PORT}`));
  } catch (err) { console.error(err); process.exit(1); }
})();

export { app, sequelize, User, Book, ReadingProgress };
