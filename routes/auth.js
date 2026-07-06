const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Credit = require('../models/Credit');
const { protect } = require('../middleware/auth');

const router = express.Router();

// توليد عمر عشوائي للزوار
const generateRandomAge = () => Math.floor(Math.random() * (99 - 20 + 1)) + 20;

// دخول زائر
router.post('/visitor-login', async (req, res) => {
  try {
    const { name, gender } = req.body;

    const visitor = new User({
      username: `${name}_${Math.random().toString(36).substr(2, 9)}`,
      email: `visitor_${Date.now()}@temp.com`,
      password: 'temp_password',
      userType: 'visitor',
      rank: '👤زائر',
      gender: gender,
      age: generateRandomAge(),
      country: 'اليمن'
    });

    await visitor.save();

    // إنشاء رصيد للزائر
    await Credit.create({
      userId: visitor._id,
      balance: 100
    });

    const token = jwt.sign(
      { id: visitor._id },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(200).json({
      success: true,
      token,
      user: visitor.toJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// تسجيل عضو جديد
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // التحقق من وجود المستخدم
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'المستخدم موجود بالفعل' });
    }

    // إنشاء مستخدم جديد
    user = new User({
      username,
      email,
      password,
      userType: 'member',
      rank: '🧑‍💼عضو',
      gender: 'آخر',
      age: 20,
      country: 'اليمن'
    });

    await user.save();

    // إنشاء رصيد
    await Credit.create({
      userId: user._id,
      balance: 100
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// دخول عضو
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // التحقق من المستخدم
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }] 
    });

    if (!user) {
      return res.status(401).json({ message: 'بيانات دخول غير صحيحة' });
    }

    // التحقق من كلمة المرور
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'بيانات دخول غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// الحصول على البيانات الحالية للمستخدم
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('friends');
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
