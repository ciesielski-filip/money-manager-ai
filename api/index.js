process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection inside Vercel Lambda:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception inside Vercel Lambda:', err);
});

const app = require('../backend/server.js');

module.exports = app;
