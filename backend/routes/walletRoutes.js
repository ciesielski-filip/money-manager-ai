const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

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
    const { action, targetWalletId } = req.body;
    const walletId = req.params.id;

    if (action === 'move') {
      if (!targetWalletId) return res.status(400).json({ error: 'Target wallet ID is required' });
      
      const transactions = await Transaction.find({ walletId });
      
      // We also need to update the target wallet's balance based on moved transactions
      const targetWallet = await Wallet.findById(targetWalletId);
      if (targetWallet) {
        for (const t of transactions) {
          const category = await Category.findById(t.categoryId);
          if (category) {
            if (category.type === 'income') {
              targetWallet.balance += t.amount;
            } else {
              targetWallet.balance -= t.amount;
            }
          }
        }
        await targetWallet.save();
      }

      await Transaction.updateMany({ walletId }, { walletId: targetWalletId });
    } else if (action === 'delete') {
      // Just delete all associated transactions. The wallet is being deleted, so we don't care about reverting balances on it.
      await Transaction.deleteMany({ walletId });
    }

    await Wallet.findByIdAndDelete(walletId);
    res.status(200).json({ message: 'Wallet deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete wallet' });
  }
});

module.exports = router;
