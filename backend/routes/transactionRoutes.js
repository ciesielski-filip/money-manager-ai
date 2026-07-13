const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');

// Add a transaction
router.post('/', async (req, res) => {
  try {
    const { amount, description, date, categoryId, householdId, userId, walletId, toWalletId, type } = req.body;
    
    if (!walletId) {
      return res.status(400).json({ error: 'Wallet ID is required' });
    }

    if (type === 'transfer') {
      if (!toWalletId) {
        return res.status(400).json({ error: 'Docelowy portfel jest wymagany przy przelewie' });
      }
      if (walletId === toWalletId) {
        return res.status(400).json({ error: 'Nie można wykonać przelewu na to samo konto' });
      }

      const newTransaction = new Transaction({
        amount: parseFloat(amount),
        type: 'transfer',
        description: description || 'Przelew między kontami',
        date: date ? new Date(date) : new Date(),
        householdId,
        userId,
        walletId,
        toWalletId
      });
      
      await newTransaction.save();

      // Update source wallet balance (-)
      const sourceWallet = await Wallet.findById(walletId);
      if (sourceWallet) {
        sourceWallet.balance -= parseFloat(amount);
        await sourceWallet.save();
      }

      // Update target wallet balance (+)
      const targetWallet = await Wallet.findById(toWalletId);
      if (targetWallet) {
        targetWallet.balance += parseFloat(amount);
        await targetWallet.save();
      }

      return res.status(201).json(newTransaction);
    }

    const category = await Category.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    const newTransaction = new Transaction({
      amount: parseFloat(amount),
      type: category.type || type || 'expense',
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
        wallet.balance += parseFloat(amount);
      } else {
        wallet.balance -= parseFloat(amount);
      }
      await wallet.save();
    }

    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Add transaction error:', error);
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
    if (walletId) {
      query.$or = [{ walletId: walletId }, { toWalletId: walletId }];
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    let transactions = await Transaction.find(query)
      .populate('categoryId', 'name type color icon')
      .populate('userId', 'name')
      .populate('walletId', 'name ownerId isShared color icon')
      .populate('toWalletId', 'name ownerId isShared color icon')
      .sort({ date: -1 });
      
    // Filter out private transactions of other users
    transactions = transactions.filter(t => {
      if (!t.walletId) return false;
      const ownerId = t.walletId.ownerId?._id ? t.walletId.ownerId._id.toString() : (t.walletId.ownerId?.toString() || '');
      const isShared = t.walletId.isShared || (t.toWalletId && t.toWalletId.isShared);
      return ownerId === userId || isShared;
    });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Fetch transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Edit a transaction
router.put('/:id', async (req, res) => {
  try {
    const { amount, description, date, categoryId, walletId, toWalletId, type } = req.body;
    const transactionId = req.params.id;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    const numAmount = parseFloat(amount);

    // Revert old transaction impact
    if (transaction.type === 'transfer' || transaction.toWalletId) {
      const oldSource = await Wallet.findById(transaction.walletId);
      if (oldSource) {
        oldSource.balance += transaction.amount;
        await oldSource.save();
      }
      if (transaction.toWalletId) {
        const oldTarget = await Wallet.findById(transaction.toWalletId);
        if (oldTarget) {
          oldTarget.balance -= transaction.amount;
          await oldTarget.save();
        }
      }
    } else {
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
    }

    // Apply new transaction impact
    if (type === 'transfer' || toWalletId) {
      const newSource = await Wallet.findById(walletId);
      if (newSource) {
        newSource.balance -= numAmount;
        await newSource.save();
      }
      const newTarget = await Wallet.findById(toWalletId);
      if (newTarget) {
        newTarget.balance += numAmount;
        await newTarget.save();
      }
      transaction.type = 'transfer';
      transaction.toWalletId = toWalletId;
      transaction.categoryId = undefined;
    } else {
      const newWallet = await Wallet.findById(walletId);
      const newCategory = await Category.findById(categoryId);
      if (newWallet && newCategory) {
        if (newCategory.type === 'income') {
          newWallet.balance += numAmount;
        } else {
          newWallet.balance -= numAmount;
        }
        await newWallet.save();
      }
      transaction.type = newCategory?.type || type || 'expense';
      transaction.categoryId = categoryId;
      transaction.toWalletId = undefined;
    }

    transaction.amount = numAmount;
    transaction.description = description;
    if (date) transaction.date = new Date(date);
    transaction.walletId = walletId;

    await transaction.save();
    res.status(200).json(transaction);
  } catch (error) {
    console.error('Edit transaction error:', error);
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
      if (transaction.type === 'transfer' || transaction.toWalletId) {
        const sourceWallet = await Wallet.findById(transaction.walletId);
        if (sourceWallet) {
          sourceWallet.balance += transaction.amount;
          await sourceWallet.save();
        }
        if (transaction.toWalletId) {
          const targetWallet = await Wallet.findById(transaction.toWalletId);
          if (targetWallet) {
            targetWallet.balance -= transaction.amount;
            await targetWallet.save();
          }
        }
      } else {
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
    }

    await Transaction.findByIdAndDelete(transactionId);
    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

module.exports = router;
