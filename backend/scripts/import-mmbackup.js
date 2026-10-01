#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const mongoose = require('mongoose');
const User = require('../models/User');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_BACKUP = path.resolve(__dirname, '../../2026_10_01_12_01_06_882092.mmbackup');
const SOURCE_NAME = 'money-manager-mmbackup';

const ICONS = {
  piggy_bank: 'PiggyBank',
  cash: 'Banknote',
  bill: 'ReceiptText',
  education: 'GraduationCap',
  return: 'Undo2',
  sea: 'Waves',
  car: 'Car',
  clothes: 'Shirt',
  other: 'Circle',
  payment: 'CreditCard',
  present: 'Gift',
  school2: 'School',
  alcohol: 'Wine',
  basket: 'ShoppingBasket',
  burger: 'Sandwich',
  cafe: 'Coffee',
  car_repair: 'Wrench',
  coins: 'Coins',
  electronics1: 'Smartphone',
  heart: 'HeartPulse',
  home: 'House',
  mobile: 'Smartphone',
  notebook: 'Notebook',
  popcorn: 'Popcorn',
  prepaid: 'WalletCards',
  products: 'ShoppingCart',
  sale: 'BadgePercent',
  sport: 'Dumbbell',
  toys: 'Gamepad2',
  transport: 'Bus',
  travels: 'Plane',
};

const parseArgs = (argv) => {
  const options = {
    apply: false,
    file: DEFAULT_BACKUP,
    fromYear: 2024,
    toYear: 2026,
    userName: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') options.apply = true;
    else if (argument === '--file') options.file = path.resolve(argv[++index]);
    else if (argument === '--from-year') options.fromYear = Number(argv[++index]);
    else if (argument === '--to-year') options.toYear = Number(argv[++index]);
    else if (argument === '--user-name') options.userName = argv[++index];
    else if (argument === '--help') {
      console.log([
        'Import Money Manager .mmbackup into Money Manager AI.',
        '',
        'Usage:',
        '  npm run import:mmbackup -- [--file PATH] [--user-name NAME] [--from-year 2024] [--to-year 2026] [--apply]',
        '',
        'Without --apply the command only validates and prints an import plan.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!Number.isInteger(options.fromYear) || !Number.isInteger(options.toYear) || options.fromYear > options.toYear) {
    throw new Error('Invalid year range');
  }
  return options;
};

const sqliteJson = (databasePath, sql) => {
  const output = execFileSync('sqlite3', ['-json', databasePath, sql], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
  return output ? JSON.parse(output) : [];
};

const extractBackup = (backupPath) => {
  const buffer = fs.readFileSync(backupPath);
  const zipOffset = buffer.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (zipOffset < 0) throw new Error('The backup does not contain a ZIP archive');

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmbackup-import-'));
  const extraction = spawnSync('bsdtar', ['-xf', '-', '-C', tempDirectory], {
    input: buffer.subarray(zipOffset),
    maxBuffer: 64 * 1024 * 1024,
  });
  if (extraction.status !== 0) {
    throw new Error(`Cannot extract backup: ${extraction.stderr?.toString() || 'unknown error'}`);
  }

  const databasePath = path.join(tempDirectory, 'MyFinance.db');
  if (!fs.existsSync(databasePath)) throw new Error('MyFinance.db is missing from the backup');
  return { databasePath, tempDirectory, backupHash: crypto.createHash('sha256').update(buffer).digest('hex') };
};

const deterministicId = (backupHash, kind, sourceId) => new mongoose.Types.ObjectId(
  crypto.createHash('sha256').update(`${SOURCE_NAME}:${backupHash}:${kind}:${sourceId}`).digest('hex').slice(0, 24)
);

const toDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const toMoney = (value) => Math.round(Number(value || 0)) / 100;

const toColor = (value, fallback) => {
  if (value === null || value === undefined || value === '') return fallback;
  const rgb = (Number(value) >>> 0) & 0xffffff;
  return `#${rgb.toString(16).padStart(6, '0')}`;
};

const importMetadata = (backupHash, sourceId, sourceEntity) => ({
  source: SOURCE_NAME,
  backupHash,
  sourceId,
  sourceEntity,
});

const sourceData = (databasePath, fromYear, toYear) => {
  const startDate = `${fromYear}-01-01`;
  const endDate = `${toYear + 1}-01-01`;

  const accounts = sqliteJson(databasePath, `
    SELECT a.*, b.value AS balanceValue
    FROM account a
    LEFT JOIN account_balance b ON b.uid = a.uid
    WHERE COALESCE(a.isRemoved, 0) = 0 AND COALESCE(a.isArchived, 0) = 0
  `);

  const categories = sqliteJson(databasePath, `
    SELECT * FROM category
    WHERE COALESCE(isRemoved, 0) = 0 AND COALESCE(isArchived, 0) = 0
  `);

  const transactions = sqliteJson(databasePath, `
    SELECT t.*,
      (SELECT otherUid FROM sync_link
        WHERE entityType = 'Transaction' AND entityUid = t.uid AND otherType = 'Account'
          AND COALESCE(isRemoved, 0) = 0 LIMIT 1) AS accountUid,
      (SELECT otherUid FROM sync_link
        WHERE entityType = 'Transaction' AND entityUid = t.uid AND otherType = 'Category'
          AND COALESCE(isRemoved, 0) = 0 LIMIT 1) AS categoryUid
    FROM \"transaction\" t
    WHERE COALESCE(t.isRemoved, 0) = 0 AND t.date >= '${startDate}' AND t.date < '${endDate}'
  `);

  const transfers = sqliteJson(databasePath, `
    SELECT t.*,
      (SELECT otherUid FROM sync_link
        WHERE entityType = 'Transfer' AND entityUid = t.uid AND otherType = 'FromAccount'
          AND COALESCE(isRemoved, 0) = 0 LIMIT 1) AS fromAccountUid,
      (SELECT otherUid FROM sync_link
        WHERE entityType = 'Transfer' AND entityUid = t.uid AND otherType = 'ToAccount'
          AND COALESCE(isRemoved, 0) = 0 LIMIT 1) AS toAccountUid
    FROM transfer t
    WHERE COALESCE(t.isRemoved, 0) = 0 AND t.date >= '${startDate}' AND t.date < '${endDate}'
  `);

  return { accounts, categories, transactions, transfers };
};

const buildPlan = ({ data, backupHash, user, fromYear, toYear }) => {
  const householdId = new mongoose.Types.ObjectId(user.householdId);
  const userId = new mongoose.Types.ObjectId(user._id);
  const accountIds = new Map(data.accounts.map(account => [account.uid, deterministicId(backupHash, 'wallet', account.uid)]));
  const categoryIds = new Map(data.categories.map(category => [category.uid, deterministicId(backupHash, 'category', category.uid)]));
  const uncategorizedIds = {
    expense: deterministicId(backupHash, 'category', 'uncategorized-expense'),
    income: deterministicId(backupHash, 'category', 'uncategorized-income'),
  };

  const wallets = data.accounts.map(account => ({
    _id: accountIds.get(account.uid),
    name: account.title || 'Portfel z importu',
    balance: toMoney(account.balanceValue),
    householdId,
    ownerId: userId,
    isShared: false,
    isArchived: Number(account.isActive) !== 1,
    color: toColor(account.color, '#3b82f6'),
    icon: ICONS[account.icon] || 'Wallet',
    createdAt: toDate(account.created),
    migration: importMetadata(backupHash, account.uid, 'account'),
  }));

  const categories = data.categories.map(category => ({
    _id: categoryIds.get(category.uid),
    name: category.title || 'Kategoria z importu',
    type: category.type === 'Income' ? 'income' : 'expense',
    householdId,
    color: toColor(category.color, '#64748b'),
    icon: ICONS[category.icon] || 'Circle',
    costType: 'variable',
    migration: importMetadata(backupHash, category.uid, 'category'),
  }));

  const acceptedTransactions = [];
  const skippedTransactions = [];
  let uncategorizedExpense = 0;
  let uncategorizedIncome = 0;

  for (const transaction of data.transactions) {
    const walletId = accountIds.get(transaction.accountUid);
    if (!walletId) {
      skippedTransactions.push(transaction.uid);
      continue;
    }
    const type = transaction.type === 'Income' ? 'income' : 'expense';
    let categoryId = categoryIds.get(transaction.categoryUid);
    if (!categoryId) {
      categoryId = uncategorizedIds[type];
      if (type === 'income') uncategorizedIncome += 1;
      else uncategorizedExpense += 1;
    }

    acceptedTransactions.push({
      _id: deterministicId(backupHash, 'transaction', transaction.uid),
      amount: Math.abs(toMoney(transaction.amountInAccountCurrency ?? transaction.amountInDefaultCurrency)),
      type,
      description: transaction.comment || '',
      date: toDate(transaction.date),
      categoryId,
      householdId,
      userId,
      walletId,
      isAdjustment: false,
      createdAt: toDate(transaction.created, toDate(transaction.date)),
      migration: importMetadata(backupHash, transaction.uid, 'transaction'),
    });
  }

  if (uncategorizedExpense > 0) {
    categories.push({
      _id: uncategorizedIds.expense,
      name: 'Bez kategorii — wydatki',
      type: 'expense',
      householdId,
      color: '#64748b',
      icon: 'CircleHelp',
      costType: 'variable',
      migration: importMetadata(backupHash, 'uncategorized-expense', 'generated-category'),
    });
  }
  if (uncategorizedIncome > 0) {
    categories.push({
      _id: uncategorizedIds.income,
      name: 'Bez kategorii — dochody',
      type: 'income',
      householdId,
      color: '#10b981',
      icon: 'CircleHelp',
      costType: 'variable',
      migration: importMetadata(backupHash, 'uncategorized-income', 'generated-category'),
    });
  }

  const acceptedTransfers = [];
  const skippedTransfers = [];
  for (const transfer of data.transfers) {
    const walletId = accountIds.get(transfer.fromAccountUid);
    const toWalletId = accountIds.get(transfer.toAccountUid);
    if (!walletId || !toWalletId || walletId.equals(toWalletId)) {
      skippedTransfers.push(transfer.uid);
      continue;
    }
    acceptedTransfers.push({
      _id: deterministicId(backupHash, 'transfer', transfer.uid),
      amount: Math.abs(toMoney(transfer.fromAmount)),
      type: 'transfer',
      description: transfer.comment || 'Przelew między kontami',
      date: toDate(transfer.date),
      householdId,
      userId,
      walletId,
      toWalletId,
      isAdjustment: false,
      createdAt: toDate(transfer.created, toDate(transfer.date)),
      migration: importMetadata(backupHash, transfer.uid, 'transfer'),
    });
  }

  const yearCounts = {};
  for (const transaction of [...acceptedTransactions, ...acceptedTransfers]) {
    const year = transaction.date.getUTCFullYear();
    if (!yearCounts[year]) yearCounts[year] = { transactions: 0, transfers: 0 };
    if (transaction.type === 'transfer') yearCounts[year].transfers += 1;
    else yearCounts[year].transactions += 1;
  }

  return {
    wallets,
    categories,
    transactions: [...acceptedTransactions, ...acceptedTransfers],
    report: {
      period: `${fromYear}-${toYear}`,
      targetUser: user.name,
      targetHouseholdId: String(householdId),
      activeWallets: wallets.filter(wallet => !wallet.isArchived).length,
      archivedWallets: wallets.filter(wallet => wallet.isArchived).length,
      categories: categories.length,
      transactions: acceptedTransactions.length,
      transfers: acceptedTransfers.length,
      skippedTransactions: skippedTransactions.length,
      skippedTransfers: skippedTransfers.length,
      uncategorizedExpense,
      uncategorizedIncome,
      yearCounts,
    },
  };
};

const upsertDocuments = async (collection, documents) => {
  if (documents.length === 0) return;
  const batchSize = 500;
  for (let index = 0; index < documents.length; index += batchSize) {
    const batch = documents.slice(index, index + batchSize);
    await collection.bulkWrite(batch.map(document => ({
      replaceOne: {
        filter: { _id: document._id },
        replacement: document,
        upsert: true,
      },
    })), { ordered: true });
  }
};

const verifyImport = async (database, plan, backupHash) => {
  const filter = { 'migration.source': SOURCE_NAME, 'migration.backupHash': backupHash };
  const [wallets, categories, transactions] = await Promise.all([
    database.collection('wallets').countDocuments(filter),
    database.collection('categories').countDocuments(filter),
    database.collection('transactions').countDocuments(filter),
  ]);
  const expectedTransactions = plan.report.transactions + plan.report.transfers;
  if (wallets !== plan.wallets.length || categories !== plan.categories.length || transactions !== expectedTransactions) {
    throw new Error(`Verification failed: wallets ${wallets}/${plan.wallets.length}, categories ${categories}/${plan.categories.length}, transactions ${transactions}/${expectedTransactions}`);
  }
  return { wallets, categories, transactions };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.file)) throw new Error(`Backup not found: ${options.file}`);
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in backend/.env');

  let tempDirectory;
  try {
    const extracted = extractBackup(options.file);
    tempDirectory = extracted.tempDirectory;
    const data = sourceData(extracted.databasePath, options.fromYear, options.toYear);

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    let users;
    if (options.userName) users = await User.find({ name: options.userName, householdId: { $ne: null } }).lean();
    else users = await User.find({ householdId: { $ne: null } }).lean();
    if (users.length !== 1) {
      throw new Error(options.userName
        ? `Expected one user named ${options.userName}, found ${users.length}`
        : `Expected exactly one user with a household, found ${users.length}. Pass --user-name.`);
    }

    const plan = buildPlan({
      data,
      backupHash: extracted.backupHash,
      user: users[0],
      fromYear: options.fromYear,
      toYear: options.toYear,
    });
    console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', ...plan.report }, null, 2));

    if (!options.apply) {
      console.log('Dry-run complete. No MongoDB documents were changed.');
      return;
    }

    const database = mongoose.connection.db;
    await upsertDocuments(database.collection('wallets'), plan.wallets);
    await upsertDocuments(database.collection('categories'), plan.categories);
    await upsertDocuments(database.collection('transactions'), plan.transactions);
    const verification = await verifyImport(database, plan, extracted.backupHash);
    await database.collection('migrationimports').updateOne(
      { source: SOURCE_NAME, backupHash: extracted.backupHash, householdId: new mongoose.Types.ObjectId(users[0].householdId) },
      {
        $set: {
          source: SOURCE_NAME,
          backupHash: extracted.backupHash,
          householdId: new mongoose.Types.ObjectId(users[0].householdId),
          userId: new mongoose.Types.ObjectId(users[0]._id),
          period: plan.report.period,
          report: plan.report,
          verified: verification,
          completedAt: new Date(),
        },
      },
      { upsert: true }
    );
    console.log('Import and verification completed successfully.');
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};

main().catch(error => {
  console.error(`Import failed: ${error.message}`);
  process.exitCode = 1;
});
