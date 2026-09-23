import { sequelize, User, Book } from './server.mjs';
import bcrypt from 'bcryptjs';

await sequelize.sync();

const existingAdmins = await User.count();
if (existingAdmins === 0) {
  await User.create({
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin'
  });
  console.log('Seeded admin user');
}

const demos = [
  { title: 'The Art of Programming', author: 'Donald Knuth', description: 'A comprehensive guide to computer programming fundamentals and best practices.', genre: 'Technology', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%231a2a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="24" x="100" y="150" text-anchor="middle"%3EThe Art of%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="24" x="100" y="185" text-anchor="middle"%3EProgramming%3C/text%3E%3C/svg%3E', featured: true, newRelease: false, pageCount: 450 },
  { title: 'Mystery of the Ancient Temple', author: 'Sarah Johnson', description: 'A thrilling adventure through hidden temples and ancient secrets.', genre: 'Adventure', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%232d4a3e" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="20" x="100" y="140" text-anchor="middle"%3EMystery of the%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="20" x="100" y="165" text-anchor="middle"%3EAncient Temple%3C/text%3E%3C/svg%3E', featured: true, newRelease: true, pageCount: 320 },
  { title: 'Digital Marketing Mastery', author: 'John Williams', description: 'Learn modern digital marketing strategies from industry experts.', genre: 'Business', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%234a3a2a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="140" text-anchor="middle"%3EDigital Marketing%3C/text%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="165" text-anchor="middle"%3EMastery%3C/text%3E%3C/svg%3E', featured: false, newRelease: true, pageCount: 280 },
  { title: 'Poetry of the Soul', author: 'Emily Dickinson', description: 'A collection of profound and beautiful poetry that touches the heart.', genre: 'Poetry', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%233a2a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="22" x="100" y="140" text-anchor="middle"%3EPoetry of%3C/text%3E%3Ctext fill="%23e8a87c" font-family="serif" font-size="22" x="100" y="165" text-anchor="middle"%3Ethe Soul%3C/text%3E%3C/svg%3E', featured: true, newRelease: false, pageCount: 195 },
  { title: 'Science Explained', author: 'Carl Sagan', description: 'An accessible introduction to complex scientific concepts.', genre: 'Science', coverUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="300"%3E%3Crect fill="%232a3a4a" width="200" height="300"/%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="140" text-anchor="middle"%3EScience%3C/text%3E%3Ctext fill="%23e8a87c" font-family="sans-serif" font-size="18" x="100" y="165" text-anchor="middle"%3EExplained%3C/text%3E%3C/svg%3E', featured: false, newRelease: false, pageCount: 512 }
];

for (const b of demos) {
  const exists = await Book.findOne({ where: { title: b.title } });
  if (!exists) {
    await Book.create(b);
    console.log(`Seeded book: ${b.title}`);
  }
}

console.log('Demo seeding complete');
await sequelize.close();
process.exit(0);
