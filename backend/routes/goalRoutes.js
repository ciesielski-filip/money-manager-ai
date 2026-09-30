const express = require('express');
const router = express.Router();
const Goal = require('../models/Goal');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const GoldHolding = require('../models/GoldHolding');

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundWeight = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
const GOLD_RATE_CACHE_TTL_MS = 60 * 60 * 1000;
let cachedGoldRate = null;
let cachedGoldRateAt = 0;

const parseAmount = (amount) => {
  const parsed = roundMoney(parseFloat(amount));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const populateGoalTransaction = (transaction) => transaction.populate([
  { path: 'walletId', select: 'name color icon' },
  { path: 'userId', select: 'name' },
]);

const getGoldRate = async () => {
  const now = Date.now();
  if (cachedGoldRate && now - cachedGoldRateAt < GOLD_RATE_CACHE_TTL_MS) {
    return cachedGoldRate;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch('https://api.nbp.pl/api/cenyzlota?format=json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`NBP returned ${response.status}`);
    const data = await response.json();
    const latest = Array.isArray(data) ? data[0] : null;
    const price = Number(latest?.cena);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Invalid NBP gold rate payload');
    }

    cachedGoldRate = {
      pricePerGram: roundMoney(price),
      date: latest.data,
      source: 'NBP',
    };
    cachedGoldRateAt = now;
    return cachedGoldRate;
  } catch (error) {
    console.error('Goal gold rate fetch failed:', error.message);
    return cachedGoldRate || {
      pricePerGram: 350,
      date: new Date().toISOString().slice(0, 10),
      source: 'NBP',
      isFallback: true,
    };
  }
};

const toId = (value) => value?.toString?.() || String(value);

const withStats = (goalDoc, assignedGoldValue = 0, assignedGoldGrams = 0) => {
  const goal = goalDoc.toObject ? goalDoc.toObject() : goalDoc;
  const now = new Date();
  const deadline = new Date(goal.deadline);
  const msRemaining = deadline.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
  const monthsRemaining = Math.max(1, Math.ceil(Math.max(daysRemaining, 0) / 30));
  const cashAmount = roundMoney(goal.currentAmount);
  const goldValue = roundMoney(assignedGoldValue);
  const effectiveCurrentAmount = roundMoney(cashAmount + goldValue);
  const remainingAmount = Math.max(0, roundMoney(goal.targetAmount - effectiveCurrentAmount));
  const monthlyTarget = roundMoney(remainingAmount / monthsRemaining);
  const progressPercentage = goal.targetAmount > 0
    ? Math.min(100, Math.round((effectiveCurrentAmount / goal.targetAmount) * 100))
    : 0;
  const status = goal.status === 'in_progress' && progressPercentage >= 100 ? 'completed' : goal.status;

  return {
    ...goal,
    currentAmount: effectiveCurrentAmount,
    cashAmount,
    assignedGoldValue: goldValue,
    assignedGoldGrams: roundWeight(assignedGoldGrams),
    status,
    daysRemaining,
    monthsRemaining,
    monthlyTarget,
    progressPercentage,
    isOverdue: deadline < now && progressPercentage < 100,
  };
};

const canAccessGoal = (goal, userId) => goal.userId.toString() === userId || goal.isShared;

const canAccessWallet = (wallet, userId) => wallet.ownerId.toString() === userId || wallet.isShared;

const getAccessibleGoal = async (goalId, userId) => {
  const goal = await Goal.findById(goalId);
  if (!goal) return { errorStatus: 404, error: 'Goal not found' };
  if (!canAccessGoal(goal, userId)) return { errorStatus: 403, error: 'Not authorized to access this goal' };
  return { goal };
};

const getAssignedGoldByGoal = async (householdId, goalIds) => {
  const rate = await getGoldRate();
  const holdings = await GoldHolding.find({
    householdId,
    goalId: { $in: goalIds },
  });

  const byGoal = holdings.reduce((acc, holding) => {
    const goalId = toId(holding.goalId);
    if (!acc[goalId]) acc[goalId] = { grams: 0, value: 0 };
    const grams = Number(holding.weightGrams || 0);
    acc[goalId].grams += grams;
    acc[goalId].value += grams * rate.pricePerGram;
    return acc;
  }, {});

  return { byGoal, rate };
};

const withCurrentGoldStats = async (goal) => {
  const { byGoal, rate } = await getAssignedGoldByGoal(goal.householdId, [goal._id]);
  const assigned = byGoal[toId(goal._id)] || { grams: 0, value: 0 };
  return {
    ...withStats(goal, assigned.value, assigned.grams),
    goldRate: rate,
  };
};

router.get('/', async (req, res) => {
  try {
    const { householdId, userId } = req.query;

    if (!householdId || !userId) {
      return res.status(400).json({ error: 'Household ID and User ID are required' });
    }

    const goals = await Goal.find({
      householdId,
      $or: [
        { userId },
        { isShared: true },
      ],
    }).sort({ status: 1, deadline: 1, createdAt: -1 });

    const goalIds = goals.map(goal => goal._id);
    const { byGoal, rate } = await getAssignedGoldByGoal(householdId, goalIds);
    res.status(200).json(goals.map(goal => {
      const assigned = byGoal[toId(goal._id)] || { grams: 0, value: 0 };
      return {
        ...withStats(goal, assigned.value, assigned.grams),
        goldRate: rate,
      };
    }));
  } catch (error) {
    console.error('Fetch goals error:', error);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const { errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });

    const transactions = await Transaction.find({ goalId: req.params.id })
      .populate('walletId', 'name color icon')
      .populate('userId', 'name')
      .sort({ date: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    console.error('Fetch goal transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch goal transactions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, targetAmount, deadline, color, icon, isShared, householdId, userId } = req.body;
    const amount = parseAmount(targetAmount);

    if (!name || !deadline || !householdId || !userId) {
      return res.status(400).json({ error: 'Name, deadline, household ID and user ID are required' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Target amount must be greater than zero' });
    }

    const goal = new Goal({
      name,
      targetAmount: amount,
      deadline: new Date(deadline),
      color: color || '#10b981',
      icon: icon || 'PiggyBank',
      isShared: Boolean(isShared),
      householdId,
      userId,
    });

    await goal.save();
    res.status(201).json(await withCurrentGoldStats(goal));
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { userId, name, targetAmount, deadline, color, icon, isShared, status } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });
    if (goal.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only goal owner can edit this goal' });
    }

    if (name !== undefined) goal.name = name;
    if (targetAmount !== undefined) {
      const amount = parseAmount(targetAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Target amount must be greater than zero' });
      }
      goal.targetAmount = amount;
      if (goal.currentAmount >= amount && goal.status !== 'cancelled') goal.status = 'completed';
      if (goal.currentAmount < amount && goal.status === 'completed') goal.status = 'in_progress';
    }
    if (deadline !== undefined) goal.deadline = new Date(deadline);
    if (color !== undefined) goal.color = color;
    if (icon !== undefined) goal.icon = icon;
    if (isShared !== undefined) goal.isShared = Boolean(isShared);
    if (status !== undefined) goal.status = status;

    await goal.save();
    res.status(200).json(await withCurrentGoldStats(goal));
  } catch (error) {
    console.error('Edit goal error:', error);
    res.status(500).json({ error: 'Failed to edit goal' });
  }
});

router.post('/:id/deposit', async (req, res) => {
  try {
    const { walletId, amount, userId, description } = req.body;
    const depositAmount = parseAmount(amount);

    if (!walletId || !userId) return res.status(400).json({ error: 'Wallet ID and User ID are required' });
    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.householdId.toString() !== goal.householdId.toString()) {
      return res.status(400).json({ error: 'Wallet does not belong to this household' });
    }
    if (!canAccessWallet(wallet, userId)) {
      return res.status(403).json({ error: 'Not authorized to use this wallet' });
    }
    if (roundMoney(wallet.balance) < depositAmount) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    const previousWalletBalance = wallet.balance;
    const previousGoalAmount = goal.currentAmount;
    const previousGoalStatus = goal.status;

    wallet.balance = roundMoney(wallet.balance - depositAmount);
    goal.currentAmount = roundMoney(goal.currentAmount + depositAmount);
    if (goal.currentAmount >= goal.targetAmount && goal.status !== 'cancelled') {
      goal.status = 'completed';
    }

    let transaction;
    try {
      transaction = await Transaction.create({
        amount: depositAmount,
        type: 'goal_deposit',
        description: description || `Wpłata na cel: ${goal.name}`,
        walletId,
        goalId: goal._id,
        householdId: goal.householdId,
        userId,
        date: new Date(),
      });
      await wallet.save();
      await goal.save();
      await populateGoalTransaction(transaction);
    } catch (transactionError) {
      wallet.balance = previousWalletBalance;
      goal.currentAmount = previousGoalAmount;
      goal.status = previousGoalStatus;
      await Promise.all([wallet.save(), goal.save()]);
      throw transactionError;
    }

    res.status(200).json({ ...(await withCurrentGoldStats(goal)), latestTransaction: transaction });
  } catch (error) {
    console.error('Deposit goal error:', error);
    res.status(500).json({ error: 'Failed to deposit to goal' });
  }
});

router.post('/:id/withdraw', async (req, res) => {
  try {
    const { walletId, amount, userId, description } = req.body;
    const withdrawAmount = parseAmount(amount);

    if (!walletId || !userId) return res.status(400).json({ error: 'Wallet ID and User ID are required' });
    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });

    const wallet = await Wallet.findById(walletId);
    if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
    if (wallet.householdId.toString() !== goal.householdId.toString()) {
      return res.status(400).json({ error: 'Wallet does not belong to this household' });
    }
    if (!canAccessWallet(wallet, userId)) {
      return res.status(403).json({ error: 'Not authorized to use this wallet' });
    }
    if (roundMoney(goal.currentAmount) < withdrawAmount) {
      return res.status(400).json({ error: 'Goal balance is too low' });
    }

    const previousGoalAmount = goal.currentAmount;
    const previousGoalStatus = goal.status;
    const previousWalletBalance = wallet.balance;

    goal.currentAmount = roundMoney(goal.currentAmount - withdrawAmount);
    if (goal.status === 'completed') goal.status = 'in_progress';
    wallet.balance = roundMoney(wallet.balance + withdrawAmount);

    let transaction;
    try {
      transaction = await Transaction.create({
        amount: withdrawAmount,
        type: 'goal_withdraw',
        description: description || `Wypłata z celu: ${goal.name}`,
        walletId,
        goalId: goal._id,
        householdId: goal.householdId,
        userId,
        date: new Date(),
      });
      await goal.save();
      await wallet.save();
      await populateGoalTransaction(transaction);
    } catch (transactionError) {
      goal.currentAmount = previousGoalAmount;
      goal.status = previousGoalStatus;
      wallet.balance = previousWalletBalance;
      await Promise.all([goal.save(), wallet.save()]);
      throw transactionError;
    }

    res.status(200).json({ ...(await withCurrentGoldStats(goal)), latestTransaction: transaction });
  } catch (error) {
    console.error('Withdraw goal error:', error);
    res.status(500).json({ error: 'Failed to withdraw from goal' });
  }
});

router.post('/:id/gold-value', async (req, res) => {
  try {
    const { userId, goldHoldingId } = req.body;

    if (!userId || !goldHoldingId) {
      return res.status(400).json({ error: 'User ID and gold holding ID are required' });
    }

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });

    const holding = await GoldHolding.findById(goldHoldingId);
    if (!holding) return res.status(404).json({ error: 'Gold holding not found' });
    if (holding.householdId.toString() !== goal.householdId.toString()) {
      return res.status(400).json({ error: 'Gold holding does not belong to this household' });
    }
    if (holding.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can assign this gold holding' });
    }
    if (holding.goalId && holding.goalId.toString() !== goal._id.toString()) {
      return res.status(400).json({ error: 'Ta sztabka jest już przypięta do innego celu' });
    }

    holding.goalId = goal._id;
    await holding.save();

    res.status(200).json(await withCurrentGoldStats(goal));
  } catch (error) {
    console.error('Assign gold holding to goal error:', error);
    res.status(500).json({ error: 'Failed to assign gold holding to goal' });
  }
});

router.delete('/:id/gold-value/:holdingId', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });

    const holding = await GoldHolding.findById(req.params.holdingId);
    if (!holding) return res.status(404).json({ error: 'Gold holding not found' });
    if (holding.householdId.toString() !== goal.householdId.toString()) {
      return res.status(400).json({ error: 'Gold holding does not belong to this household' });
    }
    if (holding.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can unassign this gold holding' });
    }
    if (!holding.goalId || holding.goalId.toString() !== goal._id.toString()) {
      return res.status(400).json({ error: 'Ta sztabka nie jest przypięta do tego celu' });
    }

    holding.goalId = null;
    await holding.save();

    res.status(200).json(await withCurrentGoldStats(goal));
  } catch (error) {
    console.error('Unassign gold holding from goal error:', error);
    res.status(500).json({ error: 'Failed to unassign gold holding from goal' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { userId, refundWalletId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const { goal, errorStatus, error } = await getAccessibleGoal(req.params.id, userId);
    if (error) return res.status(errorStatus).json({ error });
    if (goal.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only goal owner can delete this goal' });
    }

    const refundAmount = roundMoney(goal.currentAmount);
    if (refundAmount > 0 && refundWalletId) {
      const wallet = await Wallet.findById(refundWalletId);
      if (!wallet) return res.status(404).json({ error: 'Refund wallet not found' });
      if (wallet.householdId.toString() !== goal.householdId.toString()) {
        return res.status(400).json({ error: 'Refund wallet does not belong to this household' });
      }
      if (!canAccessWallet(wallet, userId)) {
        return res.status(403).json({ error: 'Not authorized to use this wallet' });
      }

      wallet.balance = roundMoney(wallet.balance + refundAmount);
      await wallet.save();
      await Transaction.create({
        amount: refundAmount,
        type: 'goal_withdraw',
        description: `Zwrot środków z usuniętego celu: ${goal.name}`,
        walletId: refundWalletId,
        goalId: goal._id,
        householdId: goal.householdId,
        userId,
        date: new Date(),
      });
    }

    await GoldHolding.updateMany({ goalId: goal._id }, { $set: { goalId: null } });
    await Goal.findByIdAndDelete(goal._id);
    res.status(200).json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
