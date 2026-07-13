const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');

// Add a category
router.post('/', async (req, res) => {
  try {
    const { name, type, householdId, color, icon } = req.body;
    
    const newCategory = new Category({
      name,
      type,
      householdId,
      color: color || '#cccccc',
      icon: icon || 'circle'
    });
    
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add category' });
  }
});

// Get categories for a household
router.get('/', async (req, res) => {
  try {
    const { householdId } = req.query;
    
    if (!householdId) {
      return res.status(400).json({ error: 'Household ID is required' });
    }
    
    const categories = await Category.find({ householdId });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const { action, targetCategoryId, adjustBalance } = req.body;
    const categoryId = req.params.id;

    if (action === 'move') {
      if (!targetCategoryId) return res.status(400).json({ error: 'Target category ID is required' });
      await Transaction.updateMany({ categoryId }, { categoryId: targetCategoryId });
    } else if (action === 'delete') {
      const transactions = await Transaction.find({ categoryId });
      
      if (adjustBalance) {
        // Revert transaction impacts
        for (const t of transactions) {
          if (!t.walletId) continue;
          const wallet = await Wallet.findById(t.walletId);
          if (wallet) {
            const category = await Category.findById(t.categoryId);
            if (category) {
              if (category.type === 'income') {
                wallet.balance -= t.amount;
              } else {
                wallet.balance += t.amount;
              }
              await wallet.save();
            }
          }
        }
      }
      
      await Transaction.deleteMany({ categoryId });
    }

    await Category.findByIdAndDelete(categoryId);
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
