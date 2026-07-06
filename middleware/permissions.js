const checkRoomModerator = async (req, res, next) => {
  const { roomId } = req.params;
  const userId = req.user._id;

  const Room = require('../models/Room');
  const room = await Room.findOne({ roomId });

  const isModerator = room.moderators.some(mod => 
    mod.userId.toString() === userId.toString()
  );

  if (!isModerator && req.user.userType !== 'admin' && req.user.userType !== 'owner') {
    return res.status(403).json({ message: 'ليس لديك صلاحيات' });
  }

  next();
};

const checkAdmin = (req, res, next) => {
  if (!['admin', 'owner'].includes(req.user.userType)) {
    return res.status(403).json({ message: 'صلاحيات الإدارة مطلوبة' });
  }
  next();
};

const checkPremium = (req, res, next) => {
  if (req.user.userType !== 'verified' && !['admin', 'owner'].includes(req.user.userType)) {
    return res.status(403).json({ message: 'هذه الميزة للأعضاء المميزين فقط' });
  }
  next();
};

module.exports = {
  checkRoomModerator,
  checkAdmin,
  checkPremium
};
