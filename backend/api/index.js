const app = require('../server.js');

module.exports = async (req, res) => {
  try {
    return await app(req, res);
  } catch (err) {
    console.error('Unhandled Vercel function error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Wewnętrzny błąd serwera (Vercel): ' + (err.message || 'Brak szczegółów błędu')
      });
    }
  }
};
