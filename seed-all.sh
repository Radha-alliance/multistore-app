#!/bin/bash

# Master Seed Script for All Databases

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           🌱 Banking Data Seeding to All Databases 🌱         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")" || exit

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
  echo "❌ Error: Please run this script from the root directory"
  exit 1
fi

echo "📦 Installing seed dependencies..."
npm install --silent --save-dev > /dev/null 2>&1

cd backend

echo ""
echo "1️⃣  Seeding PostgreSQL..."
node ../scripts/seed-postgres.js
if [ $? -ne 0 ]; then
  echo "⚠️  PostgreSQL seeding had issues (database may not be accessible)"
fi

echo ""
echo "2️⃣  Seeding MongoDB..."
node ../scripts/seed-mongodb.js
if [ $? -ne 0 ]; then
  echo "⚠️  MongoDB seeding had issues (database may not be accessible)"
fi

echo ""
echo "3️⃣  Seeding Redis..."
node ../scripts/seed-redis.js
if [ $? -ne 0 ]; then
  echo "⚠️  Redis seeding had issues (database may not be accessible)"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ Seeding Complete! ✅                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Banking Data Loaded:"
echo "   • 3 Customers"
echo "   • 5 Bank Accounts"
echo "   • 4 Transactions"
echo ""
echo "🎯 Next Steps:"
echo "   1. Run: npm run dev"
echo "   2. Open: http://localhost:5173"
echo "   3. Try these queries:"
echo ""
echo "   PostgreSQL:"
echo "     SELECT * FROM accounts;"
echo "     SELECT * FROM customers WHERE country = 'USA';"
echo ""
echo "   MongoDB:"
echo "     db.accounts.find({})"
echo "     db.customers.find({country: \"USA\"})"
echo ""
echo "   The system will automatically detect where data exists"
echo "   and select the best database! 🚀"
echo ""
