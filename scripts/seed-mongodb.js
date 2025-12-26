// Seed MongoDB with Banking Data
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env.local' });

const bankingData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/banking_data.json'), 'utf-8'));

// Define schemas
const accountSchema = new mongoose.Schema({
  id: String,
  customer_id: String,
  account_type: String,
  balance: Number,
  currency: String,
  status: String,
  created_at: String,
  last_transaction: String
});

const transactionSchema = new mongoose.Schema({
  id: String,
  account_id: String,
  type: String,
  amount: Number,
  description: String,
  timestamp: String,
  status: String
});

const customerSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  date_of_birth: String,
  country: String,
  account_status: String
});

async function seedMongoDB() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.log('❌ MONGO_URI not configured');
      return;
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });

    const db = mongoose.connection;
    
    // Drop existing collections
    try {
      await db.collection('accounts').deleteMany({});
      await db.collection('transactions').deleteMany({});
      await db.collection('customers').deleteMany({});
      console.log('🗑️  Cleared existing data');
    } catch (e) {
      // Collections might not exist
    }

    // Insert data
    await db.collection('accounts').insertMany(bankingData.accounts);
    console.log(`✅ Loaded ${bankingData.accounts.length} accounts to MongoDB`);

    await db.collection('transactions').insertMany(bankingData.transactions);
    console.log(`✅ Loaded ${bankingData.transactions.length} transactions to MongoDB`);

    await db.collection('customers').insertMany(bankingData.customers);
    console.log(`✅ Loaded ${bankingData.customers.length} customers to MongoDB`);

    console.log('\n✅ MongoDB seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB seeding failed:', error.message);
    process.exit(1);
  }
}

seedMongoDB();
