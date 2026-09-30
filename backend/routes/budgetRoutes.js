const express = require('express');
const router = express.Router();
const MonthlyBudget = require('../models/MonthlyBudget');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const Category = require('../models/Category');
const User = require('../models/User');

const monthRegex = /^\d{4}-\d{2}$/;
const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const toId = (value) => value?._id?.toString?.() || value?.toString?.() || String(value || '');

const validateMonth = (month) => monthRegex.test(month);

const getMonthRange = (month) => {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(year, monthIndex - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex, 0, 23, 59, 59, 999);
  return { year, monthIndex, start, end };
};

const getMonthMeta = (month) => {
  const { year, monthIndex, start, end } = getMonthRange(month);
  const now = new Date();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === monthIndex;
  const isPastMonth = end < now && !isCurrentMonth;
  const isFutureMonth = start > now && !isCurrentMonth;
  const daysElapsed = isCurrentMonth ? Math.min(daysInMonth, now.getDate()) : (isPastMonth ? daysInMonth : 0);
  const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : (isFutureMonth ? daysInMonth : 0);

  return { year, monthIndex, start, end, daysInMonth, daysElapsed, daysRemaining, isCurrentMonth, isPastMonth, isFutureMonth };
};

const requireAccess = async (householdId, userId) => {
  if (!householdId || !userId) return { errorStatus: 400, error: 'Household ID and User ID are required' };
  const user = await User.findById(userId);
  if (!user) return { errorStatus: 404, error: 'User not found' };
  if (toId(user.householdId) !== householdId) {
    return { errorStatus: 403, error: 'Not authorized to access this household' };
  }
  return { user };
};

const getAccessibleWalletIds = async (householdId, userId) => {
  const wallets = await Wallet.find({
    householdId,
    $or: [
      { ownerId: userId },
      { isShared: true },
    ],
  }).select('_id');
  return wallets.map(wallet => wallet._id);
};

const sanitizeCategoryBudgets = async (householdId, categoryBudgets = []) => {
  const seen = new Set();
  const sanitized = [];

  for (const item of categoryBudgets) {
    const categoryId = item.categoryId;
    const limit = roundMoney(item.limit);
    if (!categoryId || !Number.isFinite(limit) || limit < 0) {
      const error = new Error('Invalid category budget');
      error.status = 400;
      throw error;
    }
    if (seen.has(categoryId)) {
      const error = new Error('Duplicate category budget');
      error.status = 400;
      throw error;
    }

    const category = await Category.findOne({ _id: categoryId, householdId });
    if (!category) {
      const error = new Error('Category not found in this household');
      error.status = 400;
      throw error;
    }

    seen.add(categoryId);
    sanitized.push({
      categoryId,
      limit,
      costType: item.costType === 'fixed' ? 'fixed' : 'variable',
    });
  }

  return sanitized;
};

const sanitizePlannedItem = async (householdId, item, current = {}) => {
  const name = String(item.name ?? current.name ?? '').trim();
  const type = item.type ?? current.type;
  const categoryId = item.categoryId ?? current.categoryId;
  const plannedAmount = roundMoney(item.plannedAmount ?? current.plannedAmount);

  if (!name || !['expense', 'income'].includes(type) || !categoryId) {
    const error = new Error('Name, type and category are required');
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
    const error = new Error('Planned amount must be greater than or equal to zero');
    error.status = 400;
    throw error;
  }

  const category = await Category.findOne({ _id: categoryId, householdId, type });
  if (!category) {
    const error = new Error('Category not found in this household');
    error.status = 400;
    throw error;
  }

  return {
    name,
    type,
    categoryId,
    plannedAmount,
    dueDate: item.dueDate !== undefined ? (item.dueDate ? new Date(item.dueDate) : undefined) : current.dueDate,
    status: ['planned', 'partial', 'completed', 'cancelled'].includes(item.status) ? item.status : (current.status || 'planned'),
    transactionIds: Array.isArray(item.transactionIds) ? item.transactionIds : (current.transactionIds || []),
    description: item.description !== undefined ? String(item.description || '') : (current.description || ''),
  };
};

const getBudgetDocument = async (householdId, month) => {
  let budget = await MonthlyBudget.findOne({ householdId, month });
  if (!budget) {
    budget = new MonthlyBudget({ householdId, month, totalBudget: null, categoryBudgets: [], plannedItems: [] });
  }
  return budget;
};

const getLinkedTransactionAmounts = async (budget, accessibleWalletIds) => {
  const ids = [...new Set(budget.plannedItems.flatMap(item => (item.transactionIds || []).map(toId)).filter(Boolean))];
  if (ids.length === 0) return {};

  const transactions = await Transaction.find({
    _id: { $in: ids },
    walletId: { $in: accessibleWalletIds },
    isAdjustment: { $ne: true },
    type: { $in: ['expense', 'income'] },
  }).populate('walletId', 'name color icon');

  return transactions.reduce((acc, transaction) => {
    acc[toId(transaction._id)] = transaction;
    return acc;
  }, {});
};

const buildBudgetResponse = async ({ householdId, userId, month }) => {
  const meta = getMonthMeta(month);
  const [budget, categories, accessibleWalletIds] = await Promise.all([
    getBudgetDocument(householdId, month),
    Category.find({ householdId }).sort({ type: 1, name: 1 }),
    getAccessibleWalletIds(householdId, userId),
  ]);

  const transactions = await Transaction.find({
    householdId,
    walletId: { $in: accessibleWalletIds },
    date: { $gte: meta.start, $lte: meta.end },
    isAdjustment: { $ne: true },
    type: { $in: ['expense', 'income'] },
  })
    .populate('categoryId', 'name type color icon')
    .populate('walletId', 'name ownerId isShared color icon')
    .sort({ date: -1 });

  const linkedTransactions = await getLinkedTransactionAmounts(budget, accessibleWalletIds);
  const spentByCategory = {};
  const incomeByCategory = {};
  let income = 0;
  let expenses = 0;

  transactions.forEach(transaction => {
    const amount = Number(transaction.amount || 0);
    const categoryId = toId(transaction.categoryId);
    if (transaction.type === 'income') {
      income += amount;
      incomeByCategory[categoryId] = roundMoney((incomeByCategory[categoryId] || 0) + amount);
    }
    if (transaction.type === 'expense') {
      expenses += amount;
      spentByCategory[categoryId] = roundMoney((spentByCategory[categoryId] || 0) + amount);
    }
  });

  income = roundMoney(income);
  expenses = roundMoney(expenses);

  const categoryBudgetById = budget.categoryBudgets.reduce((acc, item) => {
    acc[toId(item.categoryId)] = item;
    return acc;
  }, {});

  const expenseCategories = categories.filter(category => category.type === 'expense');
  const categoryIds = new Set([
    ...expenseCategories.map(category => toId(category._id)),
    ...Object.keys(categoryBudgetById),
    ...Object.keys(spentByCategory),
  ]);

  const categoryRows = Array.from(categoryIds).map(categoryId => {
    const category = categories.find(item => toId(item._id) === categoryId);
    const config = categoryBudgetById[categoryId];
    const budgetLimit = config ? roundMoney(config.limit) : null;
    const spent = roundMoney(spentByCategory[categoryId] || 0);
    const remaining = budgetLimit === null ? null : roundMoney(budgetLimit - spent);
    const percentage = budgetLimit && budgetLimit > 0 ? roundMoney((spent / budgetLimit) * 100) : null;

    return {
      categoryId,
      name: category?.name || 'Usunięta kategoria',
      icon: category?.icon || 'Circle',
      color: category?.color || '#64748b',
      costType: config?.costType || 'variable',
      budget: budgetLimit,
      spent,
      remaining,
      percentage,
      plannedTotal: 0,
      plannedActual: 0,
      plannedRemaining: 0,
    };
  }).sort((a, b) => {
    if (a.budget !== null && b.budget === null) return -1;
    if (a.budget === null && b.budget !== null) return 1;
    return a.name.localeCompare(b.name, 'pl');
  });

  const plannedItems = budget.plannedItems.map(item => {
    const linked = (item.transactionIds || [])
      .map(id => linkedTransactions[toId(id)])
      .filter(Boolean)
      .filter(transaction => transaction.type === item.type);
    const actualAmount = roundMoney(linked.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0));
    const plannedAmount = roundMoney(item.plannedAmount);
    const remainingAmount = roundMoney(plannedAmount - actualAmount);
    let derivedStatus = item.status;
    if (item.status !== 'cancelled' && linked.length > 0) {
      derivedStatus = 'completed';
    }

    return {
      id: toId(item._id),
      name: item.name,
      type: item.type,
      categoryId: toId(item.categoryId),
      plannedAmount,
      actualAmount,
      remainingAmount,
      differenceAmount: roundMoney(actualAmount - plannedAmount),
      status: derivedStatus,
      manualStatus: item.status,
      dueDate: item.dueDate,
      description: item.description || '',
      transactionIds: (item.transactionIds || []).map(toId),
      transactions: linked.map(transaction => ({
        _id: toId(transaction._id),
        amount: roundMoney(transaction.amount),
        date: transaction.date,
        description: transaction.description,
        walletId: transaction.walletId,
      })),
    };
  });

  categoryRows.forEach(row => {
    const items = plannedItems.filter(item => item.type === 'expense' && item.categoryId === row.categoryId && item.status !== 'cancelled');
    row.plannedTotal = roundMoney(items.reduce((sum, item) => sum + item.plannedAmount, 0));
    row.plannedActual = roundMoney(items.reduce((sum, item) => sum + item.actualAmount, 0));
    row.plannedRemaining = roundMoney(items.reduce((sum, item) => sum + Math.max(0, item.remainingAmount), 0));
  });

  const planSummary = plannedItems.reduce((acc, item) => {
    if (item.status === 'cancelled') {
      acc.cancelled += 1;
      return acc;
    }
    if (item.type === 'income') {
      acc.plannedIncome += item.plannedAmount;
      acc.actualIncome += item.actualAmount;
    } else {
      acc.plannedExpenses += item.plannedAmount;
      acc.actualExpenses += item.actualAmount;
    }
    if (item.status === 'completed') acc.completed += 1;
    if (item.status === 'partial') acc.partial += 1;
    if (item.status === 'planned') acc.planned += 1;
    return acc;
  }, { plannedIncome: 0, actualIncome: 0, plannedExpenses: 0, actualExpenses: 0, completed: 0, partial: 0, planned: 0, cancelled: 0 });

  Object.keys(planSummary).forEach(key => {
    if (typeof planSummary[key] === 'number') planSummary[key] = roundMoney(planSummary[key]);
  });
  planSummary.remainingExpenses = roundMoney(Math.max(0, planSummary.plannedExpenses - planSummary.actualExpenses));
  planSummary.remainingIncome = roundMoney(Math.max(0, planSummary.plannedIncome - planSummary.actualIncome));

  const totalBudget = budget.totalBudget === null || budget.totalBudget === undefined ? null : roundMoney(budget.totalBudget);
  const remainingBudget = totalBudget === null ? null : roundMoney(totalBudget - expenses);
  const budgetUsagePercentage = totalBudget && totalBudget > 0 ? roundMoney((expenses / totalBudget) * 100) : null;
  const dailyLimit = totalBudget !== null && meta.daysRemaining > 0 ? roundMoney(Math.max(0, remainingBudget) / meta.daysRemaining) : null;
  const fixedExpenses = roundMoney(categoryRows.filter(row => row.costType === 'fixed').reduce((sum, row) => sum + row.spent, 0));
  const variableExpenses = roundMoney(categoryRows.filter(row => row.costType !== 'fixed').reduce((sum, row) => sum + row.spent, 0));

  const monthElapsedPercentage = meta.daysInMonth > 0 ? roundMoney((meta.daysElapsed / meta.daysInMonth) * 100) : 0;
  const alerts = [];
  categoryRows.forEach(row => {
    if (row.budget !== null && row.spent > row.budget) {
      alerts.push(`${row.name} przekracza budżet o ${roundMoney(row.spent - row.budget).toLocaleString('pl-PL')} zł.`);
    } else if (row.percentage !== null && meta.isCurrentMonth && row.percentage > monthElapsedPercentage + 20) {
      alerts.push(`${row.name}: wykorzystano ${Math.round(row.percentage)}% budżetu przy ${Math.round(monthElapsedPercentage)}% miesiąca.`);
    }
    if (row.budget !== null && row.plannedTotal > row.budget) {
      alerts.push(`Plan w kategorii ${row.name} przekracza limit o ${roundMoney(row.plannedTotal - row.budget).toLocaleString('pl-PL')} zł.`);
    }
  });
  if (alerts.length === 0) alerts.push('Wszystkie ustawione limity mieszczą się obecnie w planie.');

  return {
    month,
    income,
    expenses,
    balance: roundMoney(income - expenses),
    totalBudget,
    remainingBudget,
    budgetUsagePercentage,
    daysInMonth: meta.daysInMonth,
    daysElapsed: meta.daysElapsed,
    daysRemaining: meta.daysRemaining,
    isCurrentMonth: meta.isCurrentMonth,
    isPastMonth: meta.isPastMonth,
    isFutureMonth: meta.isFutureMonth,
    dailyLimit,
    fixedExpenses,
    variableExpenses,
    categories: categoryRows,
    allCategories: categories.map(category => ({
      _id: toId(category._id),
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
    })),
    plannedItems,
    planSummary,
    recentTransactions: transactions.slice(0, 12),
    alerts,
  };
};

router.get('/history/list', async (req, res) => {
  try {
    const { householdId, userId, limit = 6 } = req.query;
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const now = new Date();
    const months = Array.from({ length: Number(limit) || 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    const items = [];
    for (const month of months) {
      const data = await buildBudgetResponse({ householdId, userId, month });
      items.push({
        month,
        income: data.income,
        expenses: data.expenses,
        balance: data.balance,
        totalBudget: data.totalBudget,
      });
    }

    res.status(200).json(items);
  } catch (error) {
    console.error('Budget history error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch budget history' });
  }
});

router.get('/:month/export.csv', async (req, res) => {
  try {
    const { householdId, userId } = req.query;
    const { month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const data = await buildBudgetResponse({ householdId, userId, month });
    const rows = [
      ['month', 'category', 'budget', 'spent', 'remaining', 'percentage', 'costType'],
      ...data.categories.map(row => [
        month,
        row.name,
        row.budget ?? '',
        row.spent,
        row.remaining ?? '',
        row.percentage ?? '',
        row.costType,
      ]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="budget-${month}.csv"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Budget CSV error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to export budget' });
  }
});

router.get('/:month', async (req, res) => {
  try {
    const { householdId, userId } = req.query;
    const { month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Fetch budget error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to fetch budget' });
  }
});

router.put('/:month', async (req, res) => {
  try {
    const { householdId, userId, totalBudget, categoryBudgets } = req.body;
    const { month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    if (totalBudget === '' || totalBudget === null || totalBudget === undefined) {
      budget.totalBudget = null;
    } else {
      const parsedTotal = roundMoney(totalBudget);
      if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
        return res.status(400).json({ error: 'Total budget must be greater than or equal to zero' });
      }
      budget.totalBudget = parsedTotal;
    }

    if (categoryBudgets !== undefined) {
      budget.categoryBudgets = await sanitizeCategoryBudgets(householdId, categoryBudgets);
    }

    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Save budget error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to save budget' });
  }
});

router.delete('/:month', async (req, res) => {
  try {
    const { householdId, userId } = req.body;
    const { month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    await MonthlyBudget.deleteOne({ householdId, month });
    res.status(200).json({ message: 'Budget deleted successfully' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to delete budget' });
  }
});

router.post('/:month/copy', async (req, res) => {
  try {
    const { householdId, userId, fromMonth } = req.body;
    const { month } = req.params;
    if (!validateMonth(month) || !validateMonth(fromMonth || '')) {
      return res.status(400).json({ error: 'Invalid month format' });
    }
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const source = await MonthlyBudget.findOne({ householdId, month: fromMonth });
    if (!source) return res.status(404).json({ error: 'Source budget not found' });

    const target = await getBudgetDocument(householdId, month);
    target.totalBudget = source.totalBudget;
    target.categoryBudgets = source.categoryBudgets.map(item => ({
      categoryId: item.categoryId,
      limit: item.limit,
      costType: item.costType,
    }));
    target.plannedItems = source.plannedItems.map(item => ({
      name: item.name,
      type: item.type,
      categoryId: item.categoryId,
      plannedAmount: item.plannedAmount,
      dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      status: 'planned',
      transactionIds: [],
      description: item.description,
    }));

    await target.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Copy budget error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to copy budget' });
  }
});

router.post('/:month/items', async (req, res) => {
  try {
    const { householdId, userId, item } = req.body;
    const { month } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    budget.plannedItems.push(await sanitizePlannedItem(householdId, item || {}));
    await budget.save();
    res.status(201).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Create planned item error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to create planned item' });
  }
});

router.put('/:month/items/:itemId', async (req, res) => {
  try {
    const { householdId, userId, item } = req.body;
    const { month, itemId } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    const existing = budget.plannedItems.id(itemId);
    if (!existing) return res.status(404).json({ error: 'Planned item not found' });
    existing.set(await sanitizePlannedItem(householdId, item || {}, existing));
    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Update planned item error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to update planned item' });
  }
});

router.delete('/:month/items/:itemId', async (req, res) => {
  try {
    const { householdId, userId } = req.body;
    const { month, itemId } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    const item = budget.plannedItems.id(itemId);
    if (!item) return res.status(404).json({ error: 'Planned item not found' });
    item.deleteOne();
    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Delete planned item error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to delete planned item' });
  }
});

router.post('/:month/items/:itemId/complete', async (req, res) => {
  try {
    const { householdId, userId } = req.body;
    const { month, itemId } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    const item = budget.plannedItems.id(itemId);
    if (!item) return res.status(404).json({ error: 'Planned item not found' });
    item.status = 'completed';
    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Complete planned item error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to complete planned item' });
  }
});

router.post('/:month/items/:itemId/uncomplete', async (req, res) => {
  try {
    const { householdId, userId } = req.body;
    const { month, itemId } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    const item = budget.plannedItems.id(itemId);
    if (!item) return res.status(404).json({ error: 'Planned item not found' });
    item.status = 'planned';
    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Uncomplete planned item error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to uncomplete planned item' });
  }
});

router.post('/:month/items/:itemId/link-transaction', async (req, res) => {
  try {
    const { householdId, userId, transactionId } = req.body;
    const { month, itemId } = req.params;
    if (!validateMonth(month)) return res.status(400).json({ error: 'Invalid month format' });
    const access = await requireAccess(householdId, userId);
    if (access.error) return res.status(access.errorStatus).json({ error: access.error });

    const budget = await getBudgetDocument(householdId, month);
    const item = budget.plannedItems.id(itemId);
    if (!item) return res.status(404).json({ error: 'Planned item not found' });

    const accessibleWalletIds = await getAccessibleWalletIds(householdId, userId);
    const transaction = await Transaction.findOne({
      _id: transactionId,
      householdId,
      walletId: { $in: accessibleWalletIds },
      type: item.type,
      isAdjustment: { $ne: true },
    });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found or not accessible' });

    const transactionAlreadyLinked = budget.plannedItems.some(plannedItem => (
      toId(plannedItem._id) !== toId(item._id)
      && (plannedItem.transactionIds || []).some(id => toId(id) === toId(transaction._id))
    ));
    if (transactionAlreadyLinked) {
      return res.status(400).json({ error: 'Transaction is already linked to another planned item' });
    }

    if (!(item.transactionIds || []).some(id => toId(id) === toId(transaction._id))) {
      item.transactionIds.push(transaction._id);
    }
    await budget.save();
    res.status(200).json(await buildBudgetResponse({ householdId, userId, month }));
  } catch (error) {
    console.error('Link transaction error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Failed to link transaction' });
  }
});

module.exports = router;
