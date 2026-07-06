const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
const Report = require('../models/Report');
const { protect, authorize } = require('../middleware/auth');
const { checkAdmin } = require('../middleware/permissions');

const router = express.Router();

// جميع الإبلاغات
router.get('/reports', protect, checkAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reportedBy', 'username')
      .populate('reportedUser', 'username')
      .sort({ timestamp: -1 });

    res.status(200).json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// مراجعة بلاغ
router.put('/reports/:reportId', protect, checkAdmin, async (req, res) => {
  try {
    const { status, action, adminResponse } = req.body;

    const report = await Report.findByIdAndUpdate(
      req.params.reportId,
      {
        status,
        action,
        adminResponse,
        reviewedBy: req.user._id,
        reviewedAt: Date.now()
      },
      { new: true }
    );

    res.status(200).json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// كتم مستخدم
router.post('/mute/:userId', protect, checkAdmin, async (req, res) => {
  try {
    const { roomId, duration } = req.body;
    const durationMs = duration * 60 * 1000; // تحويل لدقائق
    const muteUntil = new Date(Date.now() + durationMs);

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isMuted: { roomId, until: muteUntil } },
      { new: true }
    );

    res.status(200).json({ success: true, message: `تم كتم المستخدم لمدة ${duration} دقائق` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// حظر مستخدم
router.post('/ban/:userId', protect, checkAdmin, async (req, res) => {
  try {
    const { roomId, reason } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { isBanned: { roomId, reason, bannedAt: Date.now() } },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'تم حظر المستخدم' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// حذف رسالة
router.delete('/messages/:messageId', protect, checkAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      {
        isDeleted: true,
        deletedBy: req.user.username,
        deletedReason: reason,
        deletedAt: Date.now()
      },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'تم حذف الرسالة' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// إضافة مشرف غرفة
router.post('/assign-moderator', protect, checkAdmin, async (req, res) => {
  try {
    const { userId, roomId, role } = req.body;
    const Room = require('../models/Room');

    const room = await Room.findOneAndUpdate(
      { roomId },
      {
        $push: {
          moderators: {
            userId,
            role,
            assignedAt: Date.now(),
            assignedBy: req.user._id
          }
        }
      },
      { new: true }
    );

    res.status(200).json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
