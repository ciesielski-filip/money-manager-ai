const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');

// Add a transaction
router.post('/', async (req, res) => {
  try {
    const { amount, description, date, categoryId, householdId, userId, walletId } = req.body;
    
    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID is required' });
    }

    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const newTransaction = new Transaction({
      amount,
      description,
      date: date ? new Date(date) : new Date(),
      categoryId,
      householdId,
      userId,
      walletId
    });
    
    await newTransaction.save();

    // Update wallet balance
    const wallet = await Wallet.findById(walletId);
    if (wallet) {
      if (category.type === 'income') {
        wallet.balance += amount;
      } else {
        wallet.balance -= amount;
      }
      await wallet.save();
    }

    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add transaction' });
  }
});

// Get transactions for a household
router.get('/', async (req, res) => {
  try {
    const { householdId, month, year, walletId, userId } = req.query;
    
    if (!householdId || !userId) {
      return res.status(400).json({ error: 'Household ID and User ID are required' });
    }
    
    let query = { householdId };
    if (walletId) query.walletId = walletId;

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    let transactions = await Transaction.find(query)
      .populate('categoryId', 'name type color icon')
      .populate('userId', 'name')
      .populate('walletId', 'name ownerId isShared')
      .sort({ date: -1 });
      
    // Filter out private transactions of other users
    transactions = transactions.filter(t => {
      if (!t.walletId) return false;
      const ownerId = t.walletId.ownerId._id ? t.walletId.ownerId._id.toString() : t.walletId.ownerId.toString();
      return ownerId === userId || t.walletId.isShared;
    });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Edit a transaction
router.put('/:id', async (req, res) => {
  try {
    const { amount, description, date, categoryId, walletId } = req.body;
    const transactionId = req.params.id;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Revert old transaction impact
    const oldWallet = await Wallet.findById(transaction.walletId);
    const oldCategory = await Category.findById(transaction.categoryId);
    if (oldWallet && oldCategory) {
      if (oldCategory.type === 'income') {
        oldWallet.balance -= transaction.amount;
      } else {
        oldWallet.balance += transaction.amount;
      }
      await oldWallet.save();
    }

    // Apply new transaction impact
    const newWallet = await Wallet.findById(walletId);
    const newCategory = await Category.findById(categoryId);
    if (newWallet && newCategory) {
      if (newCategory.type === 'income') {
        newWallet.balance += amount;
      } else {
        newWallet.balance -= amount;
      }
      await newWallet.save();
    }

    transaction.amount = amount;
    transaction.description = description;
    if (date) transaction.date = new Date(date);
    transaction.categoryId = categoryId;
    transaction.walletId = walletId;

    await transaction.save();
    res.status(200).json(transaction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit transaction' });
  }
});

// Delete a transaction
router.delete('/:id', async (req, res) => {
  try {
    const { adjustBalance } = req.body;
    const transactionId = req.params.id;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    if (adjustBalance) {
      const wallet = await Wallet.findById(transaction.walletId);
      const category = await Category.findById(transaction.categoryId);
      if (wallet && category) {
        if (category.type === 'income') {
          wallet.balance -= transaction.amount;
        } else {
          wallet.balance += transaction.amount;
        }
        await wallet.save();
      }
    }

    await Transaction.findByIdAndDelete(transactionId);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
