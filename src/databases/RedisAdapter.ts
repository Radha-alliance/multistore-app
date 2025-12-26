import axios from 'axios';

export interface DatabaseAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: any, params?: any): Promise<any>;
}

export class RedisAdapter implements DatabaseAdapter {
  name = 'Redis';
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = process.env.UPSTASH_REDIS_REST_URL || '';
    this.token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  }

  async connect(): Promise<void> {
    if (!this.baseUrl || !this.token) {
      const msg = 'Redis REST URL or token not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)';
      console.warn(msg);
      throw new Error(msg);
    }

    try {
      // Test connection with PING command
      await axios.post(
        `${this.baseUrl}/ping`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );
      console.log('Redis connected');
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Redis REST API doesn't need explicit disconnection
  }

  async executeQuery(query: any, params?: any): Promise<any> {
    if (!this.baseUrl || !this.token) {
      throw new Error('Redis REST URL or token not configured');
    }

    const { command, args = [] } = query;

    try {
      const response = await axios.post(
        `${this.baseUrl}`,
        [command, ...args],
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        }
      );
      return response.data.result;
    } catch (error) {
      console.error('Redis query error:', error);
      throw error;
    }
  }
}
