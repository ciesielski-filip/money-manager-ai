const mongoose = require('mongoose');

const categoryBudgetSchema = new mongoose.Schema({
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  limit: {
    type: Number,
    required: true,
    min: 0,
  },
  costType: {
    type: String,
    enum: ['fixed', 'variable'],
    default: 'variable',
  },
}, { _id: false });

const plannedItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['expense', 'income'],
    required: true,
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  plannedAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  dueDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['planned', 'partial', 'completed', 'cancelled'],
    default: 'planned',
  },
  transactionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  }],
  description: {
    type: String,
    default: '',
  },
}, { timestamps: true });

const monthlyBudgetSchema = new mongoose.Schema({
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: true,
  },
  month: {
    type: String,
    required: true,
    match: /^\d{4}-\d{2}$/,
  },
  totalBudget: {
    type: Number,
    min: 0,
    default: null,
  },
  categoryBudgets: [categoryBudgetSchema],
  plannedItems: [plannedItemSchema],
}, { timestamps: true });

monthlyBudgetSchema.index({ householdId: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyBudget', monthlyBudgetSchema);
