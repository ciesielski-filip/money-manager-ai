const express = require('express');
const router = express.Router();
const Household = require('../models/Household');
const User = require('../models/User');
const crypto = require('crypto');

// Create a new household and assign it to the user
router.post('/', async (req, res) => {
  try {
    const { name, userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char code
    
    const newHousehold = new Household({
      name,
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

    const household = await Household.findOne({ inviteCode });
    
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }
    
    // Update user with this household
    await User.findByIdAndUpdate(userId, { householdId: household._id });
    
    res.status(200).json(household);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join household' });
  }
});

// Get household details
router.get('/:id', async (req, res) => {
  try {
    const household = await Household.findById(req.params.id);
    if (!household) {
      return res.status(404).json({ error: 'Household not found' });
    }
    res.status(200).json(household);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch household' });
  }
});

module.exports = router;
