# Banking Data Setup & Smart Query Routing Guide

## ✅ Data Seeding Status

### Successfully Seeded ✅
- **PostgreSQL**: 3 Customers, 5 Accounts, 4 Transactions loaded

### Connectivity Issues ⚠️
- **MongoDB**: Network connectivity issue (check Atlas credentials)
- **Redis**: Network connectivity issue (check Upstash endpoint)

> Note: PostgreSQL is fully functional with banking data. You can start testing the system with PostgreSQL queries immediately.

---

## 📊 Banking Data Schema

### Customers Table/Collection
```json
{
  "id": "CUST001",
  "name": "John Smith",
  "email": "john.smith@email.com",
  "phone": "+1-555-0101",
  "date_of_birth": "1985-03-15",
  "country": "USA",
  "account_status": "Active"
}
```

### Accounts Table/Collection
```json
{
  "id": "ACC001",
  "customer_id": "CUST001",
  "account_type": "Checking",
  "balance": 5250.75,
  "currency": "USD",
  "status": "Active",
  "created_at": "2023-01-15",
  "last_transaction": "2024-12-20"
}
```

### Transactions Table/Collection
```json
{
  "id": "TXN001",
  "account_id": "ACC001",
  "type": "Debit",
  "amount": 150.00,
  "description": "Grocery Store",
  "timestamp": "2024-12-20T10:30:00Z",
  "status": "Completed"
}
```

---

## 🎯 Smart Query Routing Feature

### How It Works

The system now intelligently selects the best database:

1. **Detect Data Location**: Checks which databases have the queried table/collection
2. **Prioritize Available**: Only uses databases that contain the data
3. **Choose Best**: Among available options, selects the best performing one

### Query Examples by Database

#### PostgreSQL (✅ Ready)
```sql
-- Get all accounts
SELECT * FROM accounts;

-- Get accounts with balance > 10000
SELECT * FROM accounts WHERE balance > 10000;

-- Get customer details
SELECT * FROM customers WHERE country = 'USA';

-- Join customers and accounts
SELECT c.name, a.account_type, a.balance 
FROM customers c 
JOIN accounts a ON c.id = a.customer_id;

-- Get transaction history
SELECT * FROM transactions WHERE account_id = 'ACC001';
```

#### MongoDB (When Connected)
```javascript
// Get all accounts
db.accounts.find({})

// Get accounts with high balance
db.accounts.find({balance: {$gt: 10000}})

// Get customer details
db.customers.find({country: "USA"})

// Get specific account transactions
db.transactions.find({account_id: "ACC001"})
```

#### Redis (When Connected)
```
// Get customer profile
GET customer:CUST001

// Get account info
GET account:ACC001

// Get transaction
GET transaction:TXN001

// List all keys
KEYS banking:*
```

---

## 🚀 How to Use

### 1. Start the Application
```bash
npm run dev
```

This starts:
- Backend on http://localhost:5000
- Frontend on http://localhost:5173

### 2. Open the GUI
Navigate to http://localhost:5173

### 3. Test Smart Routing

#### Query 1: PostgreSQL Data
```sql
SELECT * FROM accounts LIMIT 5;
```
**Result**: System detects data in PostgreSQL, executes there automatically

#### Query 2: Check Data Location
```sql
SELECT COUNT(*) FROM customers;
```
**Result**: 
- Response shows "dataLocations: ['postgres']"
- Query executed on PostgreSQL
- Metrics displayed

#### Query 3: Multiple Results
Click "Test All DBs" button to see performance comparison across all databases (even if data only exists in one).

---

## 📍 Data Location Detection

### How the System Detects Data

**PostgreSQL Detection**:
- Extracts table name from `SELECT ... FROM table_name`
- Checks if table exists and has records
- If yes, adds to available databases

**MongoDB Detection**:
- Extracts collection name from `db.collection.find(...)`
- Checks if collection exists and has documents
- If yes, adds to available databases

**Redis Detection**:
- Extracts key pattern from `GET key` or `KEYS pattern`
- Checks if key exists in Redis
- If yes, adds to available databases

---

## 🏆 Best Database Selection

When data exists in multiple databases, the system chooses based on:

1. **Historical Performance** (if available):
   - Execution time (40% weight)
   - Latency (30% weight)
   - CPU time (20% weight)
   - Metric stability (10% weight)

2. **Default Scoring** (first time):
   - PostgreSQL: 0.9 (best for relational queries)
   - Redis: 0.8 (best for cached/fast access)
   - MongoDB: 0.7 (best for document queries)

---

## 💾 Data Files Location

- **Banking Data**: `/workspaces/multistore-app/data/banking_data.json`
- **Query History**: `/workspaces/multistore-app/data/query_history.json` (auto-created)
- **ML Models**: `/workspaces/multistore-app/data/ml_models.json` (auto-created)

---

## 🔧 Seeding Commands

### Seed All Databases
```bash
bash seed-all.sh
```

### Seed Individual Databases
```bash
# PostgreSQL
npm run seed:postgres

# MongoDB (if connected)
npm run seed:mongo

# Redis (if connected)
npm run seed:redis
```

---

## 📈 Expected Behavior

### When Query Matches PostgreSQL Data
1. ✅ Detects "accounts" table exists in PostgreSQL
2. ✅ Executes query on PostgreSQL
3. ✅ Returns data with metrics
4. ✅ Shows "dataLocations: ['postgres']"
5. ✅ Learns execution performance
6. ✅ Updates ML model

### When Query Doesn't Match Any Data
1. ⚠️ Detects no database has the data
2. ⚠️ Falls back to default (PostgreSQL)
3. ⚠️ Returns error or empty result
4. ✅ Still records metrics for learning

### When Data Exists in Multiple Databases
1. ✅ Detects all matching databases
2. ✅ Evaluates performance of each
3. ✅ Selects best performer
4. ✅ Shows all available locations
5. ✅ Updates recommendations

---

## 🧪 Test Scenarios

### Scenario 1: Basic Query
```sql
SELECT * FROM customers;
```
- Expected: 3 customer records from PostgreSQL
- Data locations: ['postgres']

### Scenario 2: Filtered Query
```sql
SELECT * FROM accounts WHERE balance > 10000;
```
- Expected: 2 accounts (ACC004: 150000, ACC002: 25000)
- Automatic database selection

### Scenario 3: Join Query
```sql
SELECT c.name, COUNT(a.id) as account_count 
FROM customers c 
LEFT JOIN accounts a ON c.id = a.customer_id 
GROUP BY c.id, c.name;
```
- Expected: Customer names with account counts
- PostgreSQL strength: joins and aggregations

### Scenario 4: Transaction Analysis
```sql
SELECT a.id, a.balance, COUNT(t.id) as transaction_count
FROM accounts a
LEFT JOIN transactions t ON a.id = t.account_id
GROUP BY a.id, a.balance
ORDER BY transaction_count DESC;
```
- Expected: Accounts with their transaction counts
- Shows system learning

---

## 📊 System Intelligence Features

### 1. Data Location Awareness
- Automatically detects which databases have the data
- Avoids querying empty databases
- Reduces unnecessary network calls

### 2. Adaptive Performance Selection
- Learns which database performs best for each query pattern
- Improves recommendations over time
- Considers execution time, latency, and CPU usage

### 3. Confidence Scoring
- Displays confidence level in recommendations
- More queries = higher confidence
- Helps users understand recommendation reliability

### 4. Metrics Tracking
- Real-time performance metrics
- Historical comparison
- Trend analysis

---

## 🎯 Next Steps

1. **Start the application**: `npm run dev`
2. **Open the GUI**: http://localhost:5173
3. **Try PostgreSQL queries** (data is ready):
   ```sql
   SELECT * FROM accounts;
   SELECT * FROM customers WHERE country = 'USA';
   ```
4. **Watch the system learn**: Execute same query types multiple times
5. **Check recommendations**: See how confidence improves
6. **View analytics**: Check performance trends

---

## ✨ Key Achievements

✅ **Data Loaded**: PostgreSQL successfully seeded with banking data
✅ **Smart Detection**: System detects data location automatically
✅ **Intelligent Selection**: Chooses best database among available options
✅ **Performance Tracking**: Measures and learns from executions
✅ **Adaptive Learning**: Improves recommendations with more data
✅ **Real-time Feedback**: Shows metrics and data locations in UI

---

## 🚀 Ready to Use!

Your AI-powered Multi-Store Query Mediator with banking data is ready!

**Run**: `npm run dev`
**Access**: http://localhost:5173
**Data**: ✅ PostgreSQL (3 customers, 5 accounts, 4 transactions)
