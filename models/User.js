const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userType: {
    type: String,
    enum: ['visitor', 'member', 'verified', 'moderator', 'admin', 'owner'],
    default: 'member'
  },
  rank: {
    type: String,
    enum: ['👤زائر', '🧑‍💼عضو', '💎مميز', '🛡️مشرف', '☆إدارة', '⭐ادمن', '👑مالك'],
    default: '👤زائر'
  },
  age: {
    type: Number,
    min: 13,
    max: 99
  },
  gender: {
    type: String,
    enum: ['ذكر', 'أنثى', 'آخر'],
    required: true
  },
  country: {
    type: String,
    default: 'اليمن'
  },
  profilePicture: {
    type: String,
    default: '/images/default-avatar.jpg'
  },
  bio: {
    type: String,
    maxlength: 200
  },
  credits: {
    type: Number,
    default: 100
  },
  likes: {
    type: Number,
    default: 0
  },
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastSeen: Date,
  isOnline: {
    type: Boolean,
    default: false
  },
  currentRoom: String,
  privacySettings: {
    privateMessage: {
      type: String,
      enum: ['all', 'members', 'friends', 'none'],
      default: 'all'
    },
    showProfile: {
      type: Boolean,
      default: true
    },
    showLastSeen: {
      type: Boolean,
      default: true
    }
  },
  ipAddress: String,
  deviceInfo: String,
  warnings: {
    type: Number,
    default: 0
  },
  isMuted: {
    roomId: String,
    until: Date
  },
  isBanned: {
    roomId: String,
    reason: String,
    bannedAt: Date
  },
  walletBalance: {
    type: Number,
    default: 0
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  premiumUntil: Date,
  languagePreference: {
    type: String,
    default: 'ar'
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  }
});

// تشفير كلمة المرور قبل الحفظ
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// مقارنة كلمات المرور
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// إخفاء بيانات حساسة
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.ipAddress;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
