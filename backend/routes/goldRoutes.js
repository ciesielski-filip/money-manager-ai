const express = require('express');
const router = express.Router();
const GoldHolding = require('../models/GoldHolding');

const TROY_OUNCE_GRAMS = 31.1035;
const CACHE_TTL_MS = 60 * 60 * 1000;
const FALLBACK_RATE = {
  pricePerGram: 350,
  date: new Date().toISOString().slice(0, 10),
  source: 'NBP',
  isFallback: true,
};

let cachedRate = null;
let cachedAt = 0;

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const roundWeight = (value) => Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;

const getGoldRate = async () => {
  const now = Date.now();
  if (cachedRate && now - cachedAt < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch('https://api.nbp.pl/api/cenyzlota?format=json', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`NBP returned ${response.status}`);
    const data = await response.json();
    const latest = Array.isArray(data) ? data[0] : null;
    const price = Number(latest?.cena);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Invalid NBP gold rate payload');
    }

    cachedRate = {
      pricePerGram: roundMoney(price),
      date: latest.data,
      source: 'NBP',
    };
    cachedAt = now;
    return cachedRate;
  } catch (error) {
    console.error('NBP gold rate fetch failed:', error.message);
    return cachedRate || FALLBACK_RATE;
  }
};

const buildSummary = (holdings, rate) => {
  const totalGrams = roundWeight(holdings.reduce((sum, item) => sum + Number(item.weightGrams || 0), 0));
  const totalOunces = roundWeight(totalGrams / TROY_OUNCE_GRAMS);
  const spotValue = roundMoney(totalGrams * rate.pricePerGram);
  const totalPurchasePrice = roundMoney(holdings.reduce((sum, item) => sum + Number(item.purchasePrice || 0), 0));

  return {
    totalGrams,
    totalOunces,
    spotValue,
    dealerBuybackMin: roundMoney(spotValue * 0.95),
    dealerBuybackMax: roundMoney(spotValue * 0.97),
    scrapBuyback: roundMoney(spotValue * 0.88),
    totalPurchasePrice,
    profitLoss: totalPurchasePrice > 0 ? roundMoney(spotValue - totalPurchasePrice) : null,
  };
};

const parseWeightGrams = ({ weightGrams, weight, unit, weightOunces }) => {
  const inputWeight = weightGrams ?? weight ?? weightOunces;
  const parsed = parseFloat(inputWeight);
  if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
  const selectedUnit = (unit || (weightOunces !== undefined ? 'oz' : 'g')).toLowerCase();
  return roundWeight(selectedUnit === 'oz' ? parsed * TROY_OUNCE_GRAMS : parsed);
};

const parseOptionalPrice = (purchasePrice) => {
  if (purchasePrice === '' || purchasePrice === undefined || purchasePrice === null) return undefined;
  const parsed = parseFloat(purchasePrice);
  return Number.isFinite(parsed) && parsed >= 0 ? roundMoney(parsed) : NaN;
};

router.get('/rate', async (req, res) => {
  try {
    const rate = await getGoldRate();
    res.status(200).json(rate);
  } catch (error) {
    console.error('Gold rate error:', error);
    res.status(500).json({ error: 'Failed to fetch gold rate' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { householdId, userId } = req.query;
    if (!householdId || !userId) {
      return res.status(400).json({ error: 'Household ID and User ID are required' });
    }

    const [rate, holdings] = await Promise.all([
      getGoldRate(),
      GoldHolding.find({ householdId })
        .populate('userId', 'name')
        .populate('goalId', 'name color icon')
        .sort({ createdAt: -1 }),
    ]);

    res.status(200).json({
      holdings,
      summary: buildSummary(holdings, rate),
      currentRate: rate,
    });
  } catch (error) {
    console.error('Fetch gold holdings error:', error);
    res.status(500).json({ error: 'Failed to fetch gold holdings' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, purchasePrice, purchaseDate, householdId, userId } = req.body;
    const weightGrams = parseWeightGrams(req.body);

    if (!name || !householdId || !userId) {
      return res.status(400).json({ error: 'Name, household ID and user ID are required' });
    }
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
      return res.status(400).json({ error: 'Weight must be greater than zero' });
    }
    const parsedPurchasePrice = parseOptionalPrice(purchasePrice);
    if (Number.isNaN(parsedPurchasePrice)) {
      return res.status(400).json({ error: 'Purchase price must be a valid number' });
    }

    const holding = new GoldHolding({
      name,
      weightGrams,
      purchasePrice: parsedPurchasePrice,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      householdId,
      userId,
    });

    await holding.save();
    res.status(201).json(holding);
  } catch (error) {
    console.error('Create gold holding error:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: `Failed to create gold holding: ${error.message}` });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { userId, name, purchasePrice, purchaseDate } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const holding = await GoldHolding.findById(req.params.id);
    if (!holding) return res.status(404).json({ error: 'Gold holding not found' });
    if (holding.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can edit this gold holding' });
    }

    const nextWeight = parseWeightGrams(req.body);
    if (name !== undefined) holding.name = name;
    if (Number.isFinite(nextWeight) && nextWeight > 0) holding.weightGrams = nextWeight;
    if (purchasePrice !== undefined) {
      const parsedPurchasePrice = parseOptionalPrice(purchasePrice);
      if (Number.isNaN(parsedPurchasePrice)) {
        return res.status(400).json({ error: 'Purchase price must be a valid number' });
      }
      holding.purchasePrice = parsedPurchasePrice;
    }
    if (purchaseDate !== undefined) holding.purchaseDate = purchaseDate ? new Date(purchaseDate) : undefined;

    await holding.save();
    res.status(200).json(holding);
  } catch (error) {
    console.error('Update gold holding error:', error);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: `Failed to update gold holding: ${error.message}` });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const holding = await GoldHolding.findById(req.params.id);
    if (!holding) return res.status(404).json({ error: 'Gold holding not found' });
    if (holding.userId.toString() !== userId) {
      return res.status(403).json({ error: 'Only owner can delete this gold holding' });
    }

    await GoldHolding.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Gold holding deleted successfully' });
  } catch (error) {
    console.error('Delete gold holding error:', error);
    res.status(500).json({ error: 'Failed to delete gold holding' });
  }
});

module.exports = router;
