const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateCaptcha } = require('../utils/captcha');

// User registration
router.post('/register', async (req, res) => {
  try {
    const { email, phone, password, captcha, captchaText } = req.body;

    // Validate captcha
    if (captcha !== captchaText) {
      return res.status(400).json({ error: 'Invalid captcha' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      phone,
      password: hashedPassword,
      role: 'user',
      status: 'pending' // Needs admin approval
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered, waiting for admin approval' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    // Find user
    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if approved
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account not approved yet' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user._id, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get captcha
router.get('/captcha', (req, res) => {
  const { text, data } = generateCaptcha();
  res.json({ captchaText: text, captchaImage: data });
});

// Admin approval
router.post('/approve', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'approved' },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
