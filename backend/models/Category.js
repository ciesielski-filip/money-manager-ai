const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true,
  },
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: true,
  },
  color: {
    type: String,
    default: '#cccccc'
  },
  icon: {
    type: String,
    default: 'circle'
  }
});

module.exports = mongoose.model('Category', categorySchema);
