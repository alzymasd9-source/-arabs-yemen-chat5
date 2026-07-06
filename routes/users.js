const express = require('express');
const User = require('../models/User');
const Credit = require('../models/Credit');
const { protect } = require('../middleware/auth');
const { checkPremium } = require('../middleware/permissions');

const router = express.Router();

// الحصول على ملف شخصي
router.get('/profile/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('friends')
      .select('-password -ipAddress');
    
    if (!user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// تحديث الملف الشخصي
router.put('/profile', protect, async (req, res) => {
  try {
    const { bio, country, gender, age } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { bio, country, gender, age, updatedAt: Date.now() },
      { new: true }
    );

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// إضافة صديق
router.post('/add-friend/:friendId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const friend = await User.findById(req.params.friendId);

    if (!friend) {
      return res.status(404).json({ message: 'الصديق غير موجود' });
    }

    if (user.friends.includes(friend._id)) {
      return res.status(400).json({ message: 'بالفعل أصدقاء' });
    }

    user.friends.push(friend._id);
    friend.friends.push(user._id);

    await user.save();
    await friend.save();

    res.status(200).json({ success: true, message: 'تمت إضافة الصديق' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// إعجاب
router.post('/like/:userId', protect, async (req, res) => {
  try {
    if (req.user.userType === 'visitor') {
      return res.status(403).json({ message: 'الزوار لا يستطيعون الإعجاب' });
    }

    const likedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $inc: { likes: 1 } },
      { new: true }
    );

    res.status(200).json({ success: true, likedUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// تحديث إعدادات الخصوصية
router.put('/privacy-settings', protect, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { privacySettings: req.body },
      { new: true }
    );

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// الحصول على الرصيد
router.get('/credit', protect, async (req, res) => {
  try {
    const credit = await Credit.findOne({ userId: req.user._id });
    res.status(200).json({ success: true, credit });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
