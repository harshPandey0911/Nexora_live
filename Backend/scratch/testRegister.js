const axios = require('axios');
const data = {
  name: 'Test Vendor',
  email: 'testvendor@example.com',
  phone: '9817921166',
  password: 'password123',
  aadhar: '123456789012',
  pan: 'ABCDE1234F',
  aadharDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  aadharBackDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  panDocument: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
};

axios.post('http://localhost:5000/api/vendors/auth/register', data)
  .then(res => console.log('SUCCESS:', res.data))
  .catch(err => console.error('ERROR:', err.response?.data || err.message));
