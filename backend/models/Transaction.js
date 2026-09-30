const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['expense', 'income', 'transfer', 'goal_deposit', 'goal_withdraw'],
    default: 'expense'
  },
  description: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: false,
  },
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: false,
  },
  toWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: false,
  },
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    required: false,
  },
  isAdjustment: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
