// Seed PostgreSQL with Banking Data
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env.local' });

const bankingData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/banking_data.json'), 'utf-8'));

async function seedPostgreSQL() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URI
  });

  try {
    console.log('🔗 Connecting to PostgreSQL...');
    await client.connect();

    // Create tables
    console.log('📋 Creating tables...');
    
    await client.query(`
      DROP TABLE IF EXISTS transactions CASCADE;
      DROP TABLE IF EXISTS accounts CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
    `);

    await client.query(`
      CREATE TABLE customers (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        date_of_birth DATE,
        country VARCHAR(50),
        account_status VARCHAR(20)
      );
    `);
    console.log('✅ Created customers table');

    await client.query(`
      CREATE TABLE accounts (
        id VARCHAR(20) PRIMARY KEY,
        customer_id VARCHAR(20) REFERENCES customers(id),
        account_type VARCHAR(50),
        balance DECIMAL(15, 2),
        currency VARCHAR(10),
        status VARCHAR(20),
        created_at DATE,
        last_transaction DATE
      );
    `);
    console.log('✅ Created accounts table');

    await client.query(`
      CREATE TABLE transactions (
        id VARCHAR(20) PRIMARY KEY,
        account_id VARCHAR(20) REFERENCES accounts(id),
        type VARCHAR(20),
        amount DECIMAL(15, 2),
        description VARCHAR(200),
        timestamp TIMESTAMP,
        status VARCHAR(20)
      );
    `);
    console.log('✅ Created transactions table');

    // Insert data
    for (const customer of bankingData.customers) {
      await client.query(
        `INSERT INTO customers (id, name, email, phone, date_of_birth, country, account_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [customer.id, customer.name, customer.email, customer.phone, customer.date_of_birth, customer.country, customer.account_status]
      );
    }
    console.log(`✅ Loaded ${bankingData.customers.length} customers to PostgreSQL`);

    for (const account of bankingData.accounts) {
      await client.query(
        `INSERT INTO accounts (id, customer_id, account_type, balance, currency, status, created_at, last_transaction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [account.id, account.customer_id, account.account_type, account.balance, account.currency, account.status, account.created_at, account.last_transaction]
      );
    }
    console.log(`✅ Loaded ${bankingData.accounts.length} accounts to PostgreSQL`);

    for (const transaction of bankingData.transactions) {
      await client.query(
        `INSERT INTO transactions (id, account_id, type, amount, description, timestamp, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [transaction.id, transaction.account_id, transaction.type, transaction.amount, transaction.description, transaction.timestamp, transaction.status]
      );
    }
    console.log(`✅ Loaded ${bankingData.transactions.length} transactions to PostgreSQL`);

    console.log('\n✅ PostgreSQL seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ PostgreSQL seeding failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedPostgreSQL();
