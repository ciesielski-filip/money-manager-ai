const express = require('express');
const router = express.Router();
const Household = require('../models/Household');
const User = require('../models/User');
const crypto = require('crypto');

const normalizeInviteCode = (value = '') => String(value).replace(/[\s-]/g, '').toUpperCase();

const generateInviteCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!await Household.exists({ inviteCode })) return inviteCode;
  }
  throw new Error('Could not generate a unique invite code');
};

// Create a new household and assign it to the user
router.post('/', async (req, res) => {
  try {
    const { name, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    if (!String(name || '').trim()) {
      return res.status(400).json({ error: 'Household name is required' });
    }
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inviteCode = await generateInviteCode();
    
    const newHousehold = new Household({
      name: String(name).trim(),
      inviteCode,
      creatorId: userId
    });
    
    await newHousehold.save();
    
    // Update user with this household
    await User.findByIdAndUpdate(userId, { householdId: newHousehold._id });
    
    res.status(201).json(newHousehold);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create household' });
  }
});

// Join household by invite code and assign to user
router.post('/join', async (req, res) => {
  try {
    const { inviteCode, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    const normalizedCode = normalizeInviteCode(inviteCode);
    if (normalizedCode.length !== 8) {
      return res.status(400).json({ error: 'Kod zaproszenia musi mieć 8 znaków' });
    }

    const [household, user] = await Promise.all([
      Household.findOne({ inviteCode: normalizedCode }),
      User.findById(userId),
    ]);
    
    if (!household) {
      return res.status(404).json({ error: 'Nie znaleziono budżetu dla podanego kodu' });
    }
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Update user with this household
    user.householdId = household._id;
    await user.save();
    
    res.status(200).json(household);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join household' });
  }
});

// Regenerate an invite code. Every current household member may do it.
router.post('/:id/invite-code', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const member = await User.findOne({ _id: userId, householdId: req.params.id });
    if (!member) return res.status(403).json({ error: 'Nie należysz do tego budżetu domowego' });

    const household = await Household.findById(req.params.id);
    if (!household) return res.status(404).json({ error: 'Household not found' });

    household.inviteCode = await generateInviteCode();
    await household.save();
    res.status(200).json({ inviteCode: household.inviteCode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

// Get household details and its members
router.get('/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const requestingMember = await User.findOne({ _id: userId, householdId: req.params.id });
    if (!requestingMember) {
      return res.status(403).json({ error: 'Nie należysz do tego budżetu domowego' });
    }

    const household = await Household.findById(req.params.id);
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }
    const members = await User.find({ householdId: household._id })
      .select('_id name createdAt')
      .sort({ createdAt: 1 });

    res.status(200).json({
      ...household.toObject(),
      members,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch household' });
  }
});

module.exports = router;
