const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  roomId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: String,
  icon: String,
  country: String,
  banner: String,
  rules: String,
  maxUsers: {
    type: Number,
    default: 1000
  },
  currentUsers: {
    type: Number,
    default: 0
  },
  moderators: [{
    userId: mongoose.Schema.Types.ObjectId,
    role: {
      type: String,
      enum: ['room_moderator', 'room_manager', 'room_owner']
    },
    assignedAt: Date,
    assignedBy: mongoose.Schema.Types.ObjectId
  }],
  settings: {
    allowImages: {
      type: Boolean,
      default: true
    },
    allowVoice: {
      type: Boolean,
      default: true
    },
    allowYoutube: {
      type: Boolean,
      default: true
    },
    allowFiles: {
      type: Boolean,
      default: false
    },
    autoModeration: {
      type: Boolean,
      default: true
    },
    requireApproval: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedAt: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  bannedUsers: [mongoose.Schema.Types.ObjectId],
  statistics: {
    totalMessages: {
      type: Number,
      default: 0
    },
    totalVisits: {
      type: Number,
      default: 0
    }
  }
});

module.exports = mongoose.model('Room', roomSchema);
