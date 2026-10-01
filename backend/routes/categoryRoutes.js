const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const MonthlyBudget = require('../models/MonthlyBudget');
const User = require('../models/User');

// Add a category
router.post('/', async (req, res) => {
  try {
    const { name, type, householdId, color, icon, costType } = req.body;
    
    const newCategory = new Category({
      name,
      type,
      householdId,
      color: color || '#cccccc',
      icon: icon || 'circle',
      costType: costType === 'fixed' ? 'fixed' : 'variable'
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

// Edit a category
router.put('/:id', async (req, res) => {
  try {
    const { householdId, name, color, icon, costType } = req.body;
    if (!householdId) return res.status(400).json({ error: 'Household ID is required' });

    const category = await Category.findOne({ _id: req.params.id, householdId });
    if (!category) return res.status(404).json({ error: 'Category not found' });

    if (name !== undefined) category.name = name;
    if (color !== undefined) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (costType !== undefined) category.costType = costType === 'fixed' ? 'fixed' : 'variable';

    await category.save();
    res.status(200).json(category);
  } catch (error) {
    res.status(500).json({ error: 'Failed to edit category' });
  }
});

// Delete a category
router.delete('/:id', async (req, res) => {
  try {
    const { action, targetCategoryId, adjustBalance, householdId, userId } = req.body;
    const categoryId = req.params.id;

    if (!householdId || !userId) {
      return res.status(400).json({ error: 'Household ID and User ID are required' });
    }
    if (!['move', 'delete'].includes(action)) {
      return res.status(400).json({ error: 'Invalid delete action' });
    }

    const [category, member] = await Promise.all([
      Category.findOne({ _id: categoryId, householdId }),
      User.findOne({ _id: userId, householdId }),
    ]);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    if (!member) return res.status(403).json({ error: 'Not authorized to manage this household' });

    if (action === 'move') {
      if (!targetCategoryId) return res.status(400).json({ error: 'Target category ID is required' });
      if (String(targetCategoryId) === String(categoryId)) {
        return res.status(400).json({ error: 'Target category must be different' });
      }
      const targetCategory = await Category.findOne({
        _id: targetCategoryId,
        householdId,
        type: category.type,
      });
      if (!targetCategory) {
        return res.status(404).json({ error: 'Target category not found or has a different type' });
      }

      await Transaction.updateMany({ householdId, categoryId }, { categoryId: targetCategoryId });

      const budgets = await MonthlyBudget.find({
        householdId,
        $or: [
          { 'categoryBudgets.categoryId': categoryId },
          { 'plannedItems.categoryId': categoryId },
        ],
      });
      for (const budget of budgets) {
        const sourceBudget = budget.categoryBudgets.find(item => String(item.categoryId) === String(categoryId));
        const targetBudget = budget.categoryBudgets.find(item => String(item.categoryId) === String(targetCategoryId));
        if (sourceBudget && targetBudget) {
          targetBudget.limit = Number(targetBudget.limit || 0) + Number(sourceBudget.limit || 0);
          budget.categoryBudgets = budget.categoryBudgets.filter(item => String(item.categoryId) !== String(categoryId));
        } else if (sourceBudget) {
          sourceBudget.categoryId = targetCategoryId;
        }
        budget.plannedItems.forEach(item => {
          if (String(item.categoryId) === String(categoryId)) item.categoryId = targetCategoryId;
        });
        await budget.save();
      }
    } else if (action === 'delete') {
      const transactions = await Transaction.find({ householdId, categoryId });
      
      if (adjustBalance) {
        // Revert transaction impacts
        for (const t of transactions) {
          if (!t.walletId) continue;
          const wallet = await Wallet.findById(t.walletId);
          if (wallet) {
            if (category.type === 'income') {
              wallet.balance -= t.amount;
            } else {
              wallet.balance += t.amount;
            }
            await wallet.save();
          }
        }
      }
      
      const transactionIds = transactions.map(transaction => transaction._id);
      await Transaction.deleteMany({ householdId, categoryId });
      if (transactionIds.length > 0) {
        await MonthlyBudget.updateMany(
          { householdId, 'plannedItems.transactionIds': { $in: transactionIds } },
          { $pull: { 'plannedItems.$[].transactionIds': { $in: transactionIds } } }
        );
      }
      await MonthlyBudget.updateMany(
        { householdId },
        {
          $pull: {
            categoryBudgets: { categoryId },
            plannedItems: { categoryId },
          },
        }
      );
    }

    await Category.deleteOne({ _id: categoryId, householdId });
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

module.exports = router;
