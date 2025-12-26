// PostgreSQL Adapter
const { Client } = require('pg');

class PostgresAdapter {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  async connect() {
    try {
      if (this.connected && this.client) return;

      const uri = process.env.POSTGRES_URI;
      if (!uri) {
        throw new Error('POSTGRES_URI not configured');
      }

      this.client = new Client({
        connectionString: uri,
        statement_timeout: 5000,
        query_timeout: 5000
      });

      await this.client.connect();
      this.connected = true;
      console.log('✅ PostgreSQL connected');
    } catch (error) {
      console.log('⚠️  PostgreSQL connection warning:', error.message);
      this.connected = false;
    }
  }

  async executeQuery(query) {
    try {
      await this.connect();

      if (!this.connected || !this.client) {
        return {
          success: false,
          error: 'PostgreSQL not connected',
          data: []
        };
      }

      const result = await this.client.query(query);
      
      return {
        success: true,
        data: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async hasData(table) {
    try {
      await this.connect();
      if (!this.connected || !this.client) return false;

      const result = await this.client.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      
      if (result.rows[0]?.exists) {
        const countResult = await this.client.query(`SELECT COUNT(*) FROM ${table}`);
        return parseInt(countResult.rows[0].count) > 0;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new PostgresAdapter();
