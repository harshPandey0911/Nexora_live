const bcrypt = require('bcryptjs'); // or require('bcrypt')

const hash = '$2b$10$WZDnRwPQtG0FHiegh8esHeLthXKEj8vnZa/HyeWcgeBQVzd94btCe';

const candidates = [
  '123456',
  '12345678',
  '7879363299',
  'password',
  'password123',
  'admin',
  'admin123',
  'harsh',
  'harsh123',
  'harsh@123',
  'Harsh@123',
  'Harsh123',
  'Harsh1234',
  'harshpandey',
  'harshpandey09112004',
  'harsh@2004',
  'Harsh@2004',
  'harsh1109',
  'harsh0911',
  'harshpandey123',
  'HarshPandey123',
  'Harsh@1234'
];

async function check() {
  for (const cand of candidates) {
    try {
      const match = await bcrypt.compare(cand, hash);
      if (match) {
        console.log(`MATCH FOUND: ${cand}`);
        process.exit(0);
      }
    } catch (e) {
      // try other bcrypt module
    }
  }
  console.log('No matches found.');
}

check();
