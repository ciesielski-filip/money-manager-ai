process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.options('*', cors({ origin: '*' }));
app.use(express.json());

// Health Check Routes (instant response without waiting for database)
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Money Manager AI Backend is running successfully!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Safe MongoDB Connection Helper for Serverless (Exact logic from commit 2e45bd2 + safe timeout)
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }
  
  const uri = process.env.MONGO_URI || (process.env.VERCEL ? null : 'mongodb://localhost:27017/money-manager');
  if (!uri) {
    console.warn('Brak zmiennej MONGO_URI w Vercel Environment Variables');
    return null;
  }

  try {
    await mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('Connected to MongoDB successfully');
    return mongoose.connection;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    return null;
  }
};

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/api/health') {
    return next();
  }
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    if (!res.headersSent) {
      return res.status(503).json({ 
        error: 'Błąd połączenia z bazą danych na serwerze: Sprawdź czy zmienna MONGO_URI w Vercel jest prawidłowa i czy MongoDB Atlas pozwala na dostęp z 0.0.0.0/0.' 
      });
    }
  }
  next();
});

// Routes
const householdRoutes = require('./routes/householdRoutes');
const userRoutes = require('./routes/userRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const walletRoutes = require('./routes/walletRoutes');

app.use('/api/household', householdRoutes);
app.use('/api/user', userRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/wallets', walletRoutes);

// Local Server Execution (when not running inside Vercel serverless)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
}

// Global Express Error Handler for Vercel Serverless
app.use((err, req, res, next) => {
  console.error('Global Express error caught:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Wewnętrzny błąd serwera Express: ' + (err.message || 'Nieznany błąd') });
  }
});

module.exports = app;
