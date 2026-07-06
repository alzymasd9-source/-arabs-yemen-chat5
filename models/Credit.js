const mongoose = require('mongoose');

const creditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 100,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 100
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['earn', 'purchase', 'admin_adjustment', 'refund'],
      required: true
    },
    amount: Number,
    reason: String,
    relatedItem: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Credit', creditSchema);
