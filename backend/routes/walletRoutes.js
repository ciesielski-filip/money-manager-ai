const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const MonthlyBudget = require('../models/MonthlyBudget');

// Create a new wallet
router.post('/', async (req, res) => {
  try {
    const { name, balance, householdId, ownerId, color, icon } = req.body;
    
    if (!ownerId) return res.status(400).json({ error: 'Owner ID is required' });

    const newWallet = new Wallet({
      name,
      balance: balance || 0,
      householdId,
      ownerId,
      color: color || '#3b82f6',
      icon: icon || 'CreditCard',
      isShared: false
    });
    
    await newWallet.save();
    res.status(201).json(newWallet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

// Get all accessible wallets for a household
router.get('/', async (req, res) => {
  try {
    const { householdId, userId } = req.query;
    if (!householdId || !userId) {
      return res.status(400).json({ error: 'Household ID and User ID are required' });
    }
    
    // Wallets are visible if they belong to the user OR are shared
    const wallets = await Wallet.find({ 
      householdId,
      isArchived: { $ne: true },
      $or: [
        { ownerId: userId },
        { isShared: true }
      ]
    }).populate('ownerId', 'name');
    
    res.status(200).json(wallets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallets' });
  }
});

// Edit wallet metadata
router.put('/:id', async (req, res) => {
  try {
    const { userId, name, color, icon } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const wallet = await Wallet.findById(req.params.id);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can edit this wallet' });
    }

    if (name !== undefined) wallet.name = name;
    if (color !== undefined) wallet.color = color;
    if (icon !== undefined) wallet.icon = icon;

    await wallet.save();
    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit wallet' });
  }
});

// Toggle wallet sharing
router.put('/:id/share', async (req, res) => {
  try {
    const { userId } = req.body;
    const walletId = req.params.id;

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Only owner can share
    if (wallet.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to share this wallet' });
    }

    wallet.isShared = !wallet.isShared;
    await wallet.save();

    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle share status' });
  }
});

// Adjust wallet balance manually
router.put('/:id/adjust', async (req, res) => {
  try {
    const { newBalance, userId, householdId } = req.body;
    const walletId = req.params.id;

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });

    // Only owner OR if shared can adjust
    if (wallet.ownerId.toString() !== userId && !wallet.isShared) {
      return res.status(403).json({ error: 'Not authorized to adjust this wallet' });
    }

    const difference = newBalance - wallet.balance;
    if (difference === 0) return res.status(200).json(wallet);

    const type = difference > 0 ? 'income' : 'expense';
    
    let adjustmentCategory = await Category.findOne({ householdId, name: 'Korekta', type });
    if (!adjustmentCategory) {
      adjustmentCategory = new Category({
        name: 'Korekta',
        type,
        householdId,
        color: '#888888',
        icon: 'settings-2'
      });
      await adjustmentCategory.save();
    }

    const adjustmentTransaction = new Transaction({
      amount: Math.abs(difference),
      description: 'Ręczna Korekta Salda',
      categoryId: adjustmentCategory._id,
      householdId,
      userId,
      walletId,
      isAdjustment: true
    });
    await adjustmentTransaction.save();

    wallet.balance = newBalance;
    await wallet.save();

    res.status(200).json(wallet);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust balance' });
  }
});

// Delete a wallet
router.delete('/:id', async (req, res) => {
  try {
    const { action, targetWalletId, userId, householdId } = req.body;
    const walletId = req.params.id;

    if (!userId || !householdId) {
      return res.status(400).json({ error: 'User ID and household ID are required' });
    }
    if (!['move', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid delete action' });
    }

    const wallet = await Wallet.findOne({ _id: walletId, householdId });
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can delete this wallet' });
    }

    let removedTransactionIds = [];
    if (action === 'move') {
      if (!targetWalletId) return res.status(400).json({ error: 'Target wallet ID is required' });
      if (String(targetWalletId) === String(walletId)) {
        return res.status(400).json({ error: 'Target wallet must be different' });
      }

      const targetWallet = await Wallet.findOne({
        _id: targetWalletId,
        householdId,
        isArchived: { $ne: true },
        $or: [{ ownerId: userId }, { isShared: true }],
      });
      if (!targetWallet) return res.status(404).json({ error: 'Target wallet not found or not accessible' });

      const internalTransfers = await Transaction.find({
        householdId,
        type: 'transfer',
        $or: [
          { walletId: wallet._id, toWalletId: targetWallet._id },
          { walletId: targetWallet._id, toWalletId: wallet._id },
        ],
      }).select('_id');
      removedTransactionIds = internalTransfers.map(transaction => transaction._id);
      if (removedTransactionIds.length > 0) {
        await Transaction.deleteMany({ _id: { $in: removedTransactionIds } });
      }

      await Promise.all([
        Transaction.updateMany({ householdId, walletId: wallet._id }, { walletId: targetWallet._id }),
        Transaction.updateMany({ householdId, toWalletId: wallet._id }, { toWalletId: targetWallet._id }),
      ]);

      targetWallet.balance = Number(targetWallet.balance || 0) + Number(wallet.balance || 0);
      await targetWallet.save();
    } else if (action === 'delete') {
      const transactions = await Transaction.find({
        householdId,
        $or: [{ walletId: wallet._id }, { toWalletId: wallet._id }],
      }).select('_id');
      removedTransactionIds = transactions.map(transaction => transaction._id);
      if (removedTransactionIds.length > 0) {
        await Transaction.deleteMany({ _id: { $in: removedTransactionIds } });
      }
    }

    if (removedTransactionIds.length > 0) {
      await MonthlyBudget.updateMany(
        { householdId, 'plannedItems.transactionIds': { $in: removedTransactionIds } },
        { $pull: { 'plannedItems.$[].transactionIds': { $in: removedTransactionIds } } }
      );
    }

    await Wallet.deleteOne({ _id: wallet._id });
    res.status(200).json({
      message: 'Wallet deleted successfully',
      removedTransactions: removedTransactionIds.length,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});

module.exports = router;
