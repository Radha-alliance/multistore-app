import { Pool } from 'pg';

export interface DatabaseAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: any, params?: any): Promise<any>;
}

export class PostgresAdapter implements DatabaseAdapter {
  name = 'PostgreSQL';
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.POSTGRES_URI,
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      client.release();
      console.log('PostgreSQL connected');
    } catch (error) {
      console.error('PostgreSQL connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async executeQuery(query: any, params?: any): Promise<any> {
    let text: string | undefined;
    let values: any[] = [];

    if (typeof query === 'string') {
      text = query;
    } else {
      text = query?.text;
      values = query?.values || [];
    }

    if (!text) {
      throw new Error('PostgreSQL: SQL text is required');
    }

    try {
      const result = await this.pool.query(text, values);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }
}
