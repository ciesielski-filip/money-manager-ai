const express = require('express');
const router = express.Router();
const User = require('../models/User');

const bcrypt = require('bcryptjs');

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      password: hashedPassword
    });
    
    await newUser.save();

    // Auto-create household
    const Household = require('../models/Household');
    const crypto = require('crypto');
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const newHousehold = new Household({
      name: `Budżet użytkownika ${name}`,
      inviteCode,
      creatorId: newUser._id
    });
    await newHousehold.save();

    newUser.householdId = newHousehold._id;
    await newUser.save();

    res.status(201).json({ 
      _id: newUser._id, 
      name: newUser.name,
      householdId: newHousehold._id,
      householdName: newHousehold.name
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const user = await User.findOne({ name }).populate('householdId');
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.status(200).json({
      _id: user._id,
      name: user.name,
      householdId: user.householdId?._id || null,
      householdName: user.householdId?.name || ''
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get users for a household
router.get('/:householdId', async (req, res) => {
  try {
    const users = await User.find({ householdId: req.params.householdId });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
