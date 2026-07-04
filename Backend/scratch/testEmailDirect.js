const { sendPasswordResetEmail } = require('../services/emailService');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

console.log('Using SMTP Settings:');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0);

const testMail = async () => {
  console.log('Sending test password reset email...');
  const result = await sendPasswordResetEmail(
    'sagarchouhan7609@gmail.com', 
    'Sagar Chouhan', 
    'http://localhost:5173/user/reset-password/testtoken123'
  );
  console.log('Done triggering. Check console for any nodemailer errors above.');
};

testMail();
