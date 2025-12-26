// Seed Redis with Banking Data
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env.local' });

const bankingData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/banking_data.json'), 'utf-8'));

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisCommand(command) {
  try {
    const response = await axios.post(REDIS_URL, {
      commands: [command]
    }, {
      headers: {
        'Authorization': `Bearer ${REDIS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Redis error:', error.response?.data || error.message);
    throw error;
  }
}

async function seedRedis() {
  try {
    if (!REDIS_URL || !REDIS_TOKEN) {
      console.log('❌ Redis credentials not configured');
      return;
    }

    console.log('🔗 Connecting to Redis...');
    
    // Clear existing data
    await redisCommand(['FLUSHDB']);
    console.log('🗑️  Cleared existing data');

    let count = 0;

    // Store customers
    for (const customer of bankingData.customers) {
      await redisCommand([
        'SET',
        `customer:${customer.id}`,
        JSON.stringify(customer)
      ]);
      count++;
    }
    console.log(`✅ Loaded ${bankingData.customers.length} customers to Redis`);

    // Store accounts
    for (const account of bankingData.accounts) {
      await redisCommand([
        'SET',
        `account:${account.id}`,
        JSON.stringify(account)
      ]);
      count++;
    }
    console.log(`✅ Loaded ${bankingData.accounts.length} accounts to Redis`);

    // Store transactions
    for (const transaction of bankingData.transactions) {
      await redisCommand([
        'SET',
        `transaction:${transaction.id}`,
        JSON.stringify(transaction)
      ]);
      count++;
    }
    console.log(`✅ Loaded ${bankingData.transactions.length} transactions to Redis`);

    // Create indexes
    await redisCommand(['SET', 'banking:accounts', JSON.stringify(bankingData.accounts.map(a => a.id))]);
    await redisCommand(['SET', 'banking:customers', JSON.stringify(bankingData.customers.map(c => c.id))]);
    await redisCommand(['SET', 'banking:transactions', JSON.stringify(bankingData.transactions.map(t => t.id))]);

    console.log('\n✅ Redis seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis seeding failed:', error.message);
    process.exit(1);
  }
}

seedRedis();
