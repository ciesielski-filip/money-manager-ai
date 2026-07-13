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

// Optimized MongoDB Connection Helper for Serverless & Local
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) return cached.conn;
  
  const uri = process.env.MONGO_URI || (process.env.VERCEL ? null : 'mongodb://localhost:27017/money-manager');
  if (!uri) {
    throw new Error('Brak zmiennej środowiskowej MONGO_URI w ustawieniach Vercel (Project Settings -> Environment Variables)! Pamiętaj, aby po dodaniu zmiennej kliknąć Redeploy w zakładce Deployments.');
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    cached.promise = mongoose.connect(uri, opts).then((mongoose) => {
      return mongoose;
    }).catch((err) => {
      cached.promise = null;
      throw err;
    });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
};

app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS' || req.path === '/' || req.path === '/api/health') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection error in middleware:', error);
    if (!res.headersSent) {
      res.status(503).json({ 
        error: 'Błąd połączenia z bazą danych na serwerze: ' + (error.message || 'Sprawdź MONGO_URI w Vercel Environment Variables oraz czy IP Whitelist w MongoDB Atlas to 0.0.0.0/0.') 
      });
    }
  }
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
