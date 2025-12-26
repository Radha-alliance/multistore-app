// Redis Adapter
const axios = require('axios');

// Mock data for fallback when Redis is unavailable
const MOCK_REDIS_DATA = {
  'account:ACC001': JSON.stringify({ id: 'ACC001', type: 'Checking', balance: 5250.75 }),
  'account:ACC002': JSON.stringify({ id: 'ACC002', type: 'Savings', balance: 25000.00 }),
  'account:ACC003': JSON.stringify({ id: 'ACC003', type: 'Checking', balance: 3500.50 }),
  'account:ACC004': JSON.stringify({ id: 'ACC004', type: 'Business', balance: 150000.00 }),
  'customer:CUST001': JSON.stringify({ id: 'CUST001', name: 'John Smith', country: 'USA' }),
  'customer:CUST002': JSON.stringify({ id: 'CUST002', name: 'Sarah Johnson', country: 'USA' }),
  'customer:CUST003': JSON.stringify({ id: 'CUST003', name: 'Michael Brown', country: 'USA' })
};

class RedisAdapter {
  constructor() {
    this.connected = false;
    this.useMockData = false;
    this.url = process.env.UPSTASH_REDIS_REST_URL;
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  async connect() {
    try {
      if (this.connected || this.useMockData) return; // Already tried to connect
      
      if (!this.url || !this.token) {
        console.log('⚠️  Redis: Using fallback mock data (credentials not configured)');
        this.useMockData = true;
        return;
      }

      // Test connection with a simple PING command
      try {
        const response = await axios.post(this.url, {
          commands: [['PING']]
        }, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 2000
        });
        
        this.connected = true;
        this.useMockData = false;
        console.log('✅ Redis connected');
      } catch (pingError) {
        console.log('⚠️  Redis unavailable, using fallback mock data:', pingError.message);
        this.useMockData = true;
        this.connected = false;
      }
    } catch (error) {
      console.log('⚠️  Redis connection error:', error.message);
      this.useMockData = true;
      this.connected = false;
    }
  }

  async redisCommand(command) {
    try {
      const response = await axios.post(this.url, {
        commands: [command]
      }, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        timeout: 3000
      });
      return response.data;
    } catch (error) {
      throw new Error(`Redis error: ${error.message}`);
    }
  }

  async executeQuery(query) {
    try {
      await this.connect();

      // Parse Redis queries like:
      // GET key
      // HGETALL key
      // KEYS pattern
      
      const parts = query.trim().split(/\s+/);
      const command = parts[0].toUpperCase();
      const key = parts[1];

      // Use mock data if service unavailable
      if (this.useMockData || !this.connected) {
        if (command === 'GET') {
          const value = MOCK_REDIS_DATA[key];
          return {
            success: !!value,
            data: value ? [{ key, value: JSON.parse(value) }] : [],
            source: 'mock'
          };
        } else if (command === 'KEYS') {
          const pattern = key || '*';
          const regex = new RegExp(pattern.replace('*', '.*'));
          const matchedKeys = Object.keys(MOCK_REDIS_DATA).filter(k => regex.test(k));
          return {
            success: true,
            data: matchedKeys,
            source: 'mock'
          };
        }
        return {
          success: true,
          data: [],
          source: 'mock'
        };
      }

      if (!key) {
        return {
          success: false,
          error: 'Redis query requires a key',
          data: []
        };
      }

      let result;
      if (command === 'GET') {
        result = await this.redisCommand(['GET', key]);
      } else if (command === 'HGETALL') {
        result = await this.redisCommand(['HGETALL', key]);
      } else if (command === 'KEYS') {
        result = await this.redisCommand(['KEYS', key]);
      } else {
        result = await this.redisCommand([command, key]);
      }

      const data = [];
      if (result && result.result) {
        const value = result.result;
        if (Array.isArray(value)) {
          data.push(...value.map(v => ({ value: v })));
        } else if (typeof value === 'object') {
          data.push(value);
        } else {
          data.push({ value });
        }
      }

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

  async hasData(key) {
    try {
      await this.connect();
      
      // Check mock data first
      if (this.useMockData || !this.connected) {
        return key && MOCK_REDIS_DATA[key] !== undefined;
      }

      const result = await this.redisCommand(['EXISTS', key]);
      return result?.result === 1;
    } catch (error) {
      // Fall back to mock data check
      return key && MOCK_REDIS_DATA[key] !== undefined;
    }
  }
}

module.exports = new RedisAdapter();
