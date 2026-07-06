const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'غير مصرح' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'توكن غير صحيح' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({ message: 'غير مصرح للقيام بهذا الإجراء' });
    }
    next();
  };
};

module.exports = { protect, authorize };
