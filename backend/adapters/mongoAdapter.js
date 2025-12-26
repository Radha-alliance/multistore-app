// MongoDB Adapter
const mongoose = require('mongoose');

// Mock data for fallback when MongoDB is unavailable
const MOCK_DATA = {
  accounts: [
    { id: 'ACC001', customer_id: 'CUST001', account_type: 'Checking', balance: 5250.75 },
    { id: 'ACC002', customer_id: 'CUST001', account_type: 'Savings', balance: 25000.00 },
    { id: 'ACC003', customer_id: 'CUST002', account_type: 'Checking', balance: 3500.50 },
    { id: 'ACC004', customer_id: 'CUST002', account_type: 'Business', balance: 150000.00 },
    { id: 'ACC005', customer_id: 'CUST003', account_type: 'Checking', balance: 1200.25 }
  ],
  customers: [
    { id: 'CUST001', name: 'John Smith', email: 'john@example.com', country: 'USA' },
    { id: 'CUST002', name: 'Sarah Johnson', email: 'sarah@example.com', country: 'USA' },
    { id: 'CUST003', name: 'Michael Brown', email: 'michael@example.com', country: 'USA' }
  ]
};

class MongoAdapter {
  constructor() {
    this.connected = false;
    this.useMockData = false;
  }

  async connect() {
    try {
      if (this.connected) return;
      
      const uri = process.env.MONGO_URI;
      if (!uri) {
        console.log('⚠️  MongoDB: Using fallback mock data (no URI configured)');
        this.useMockData = true;
        return;
      }

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000
      });
      
      this.connected = true;
      this.useMockData = false;
      console.log('✅ MongoDB connected');
    } catch (error) {
      console.log('⚠️  MongoDB unavailable, using fallback mock data:', error.message);
      this.useMockData = true;
      this.connected = false;
    }
  }

  async queryData(collection, filter = {}) {
    try {
      await this.connect();
      
      // Use mock data as fallback
      if (this.useMockData || !this.connected) {
        const data = MOCK_DATA[collection] || [];
        // Advanced filtering on mock data supporting MongoDB operators
        const filtered = data.filter(item => {
          return Object.entries(filter).every(([key, value]) => {
            const itemValue = item[key];
            
            // Handle MongoDB operators
            if (typeof value === 'object' && value !== null) {
              return Object.entries(value).every(([op, opValue]) => {
                switch (op) {
                  case '$gt': return itemValue > opValue;
                  case '$gte': return itemValue >= opValue;
                  case '$lt': return itemValue < opValue;
                  case '$lte': return itemValue <= opValue;
                  case '$eq': return itemValue === opValue;
                  case '$ne': return itemValue !== opValue;
                  case '$in': return Array.isArray(opValue) && opValue.includes(itemValue);
                  case '$nin': return Array.isArray(opValue) && !opValue.includes(itemValue);
                  default: return true;
                }
              });
            }
            
            // Simple equality
            return itemValue === value;
          });
        });
        
        return {
          success: true,
          data: filtered,
          rowCount: filtered.length,
          source: 'mock'
        };
      }

      const db = mongoose.connection;
      const col = db.collection(collection);
      const data = await col.find(filter).toArray();

      return {
        success: true,
        data,
        rowCount: data.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async executeQuery(query) {
    try {
      // Parse queries like:
      // db.accounts.find({customer_id: "CUST001"})
      // db.customers.find({})
      // db.transactions.find({type: "Debit"})
      // db.accounts.find({"balance":{"$gt":5000}})
      
      // More robust regex that captures complete JSON objects
      const dbMatch = query.match(/db\.(\w+)\.find\s*\(\s*({.*})\s*\)/);
      if (!dbMatch) {
        return {
          success: false,
          error: 'Invalid MongoDB query format. Use: db.collection.find({...})',
          data: []
        };
      }

      const [, collection, filterStr] = dbMatch;
      let filter = {};
      
      try {
        // Parse JSON filter - handles complex objects like {"balance":{"$gt":5000}}
        filter = JSON.parse(filterStr);
      } catch (e) {
        // Fallback: try eval for simpler cases
        try {
          filter = eval(`(${filterStr})`);
        } catch (e2) {
          filter = {};
        }
      }

      return await this.queryData(collection, filter);
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async hasData(collection) {
    try {
      await this.connect();
      
      // Check mock data first
      if (this.useMockData || !this.connected) {
        return MOCK_DATA[collection] && MOCK_DATA[collection].length > 0;
      }

      const db = mongoose.connection;
      const col = db.collection(collection);
      const count = await col.countDocuments();
      return count > 0;
    } catch (error) {
      // Fall back to mock data check
      return MOCK_DATA[collection] && MOCK_DATA[collection].length > 0;
    }
  }
}

module.exports = new MongoAdapter();
