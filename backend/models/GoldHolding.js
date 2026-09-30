const mongoose = require('mongoose');

const goldHoldingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  weightGrams: {
    type: Number,
    required: true,
    min: 0.0001,
  },
  purchasePrice: {
    type: Number,
    required: false,
    min: 0,
  },
  purchaseDate: {
    type: Date,
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
  goalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Goal',
    required: false,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('GoldHolding', goldHoldingSchema);
