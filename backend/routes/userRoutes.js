const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Household = require('../models/Household');
const crypto = require('crypto');

const bcrypt = require('bcryptjs');

const normalizeInviteCode = (value = '') => String(value).replace(/[\s-]/g, '').toUpperCase();

const generateInviteCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!await Household.exists({ inviteCode })) return inviteCode;
  }
  throw new Error('Could not generate a unique invite code');
};

// Register user
router.post('/register', async (req, res) => {
  try {
    const { name, password, inviteCode } = req.body;
    
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    const existingUser = await User.findOne({ name });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    let household = null;
    const normalizedCode = normalizeInviteCode(inviteCode);
    if (normalizedCode) {
      if (normalizedCode.length !== 8) {
        return res.status(400).json({ error: 'Kod zaproszenia musi mieć 8 znaków' });
      }
      household = await Household.findOne({ inviteCode: normalizedCode });
      if (!household) {
        return res.status(404).json({ error: 'Nie znaleziono budżetu dla podanego kodu' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      password: hashedPassword,
      householdId: household?._id,
    });
    
    await newUser.save();

    if (!household) {
      household = new Household({
        name: `Budżet użytkownika ${name}`,
        inviteCode: await generateInviteCode(),
        creatorId: newUser._id
      });
      await household.save();

      newUser.householdId = household._id;
      await newUser.save();
    }

    res.status(201).json({ 
      _id: newUser._id, 
      name: newUser.name,
      householdId: household._id,
      householdName: household.name
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
    const users = await User.find({ householdId: req.params.householdId })
      .select('_id name createdAt');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
