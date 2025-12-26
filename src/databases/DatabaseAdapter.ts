import mongoose from 'mongoose';

export interface DatabaseAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: any, params?: any): Promise<any>;
}

export class MongoDBAdapter implements DatabaseAdapter {
  name = 'MongoDB';
  private connected = false;

  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      await mongoose.connect(process.env.MONGO_URI || '', {
        serverSelectionTimeoutMS: 5000,
      });
      this.connected = true;
      console.log('MongoDB connected');
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await mongoose.disconnect();
      this.connected = false;
    }
  }

  async executeQuery(query: any, params?: any): Promise<any> {
    await this.connect();
    
    // For MongoDB, query should contain collection name and operation
    const { collection, operation, filter = {}, data = {} } = query;
    const db = mongoose.connection.db;
    
    if (!db) throw new Error('Database not connected');
    
    const col = db.collection(collection);
    
    switch (operation) {
      case 'find':
        return await col.find(filter).toArray();
      case 'findOne':
        return await col.findOne(filter);
      case 'insertOne':
        return await col.insertOne(data);
      case 'updateOne':
        return await col.updateOne(filter, { $set: data });
      case 'deleteOne':
        return await col.deleteOne(filter);
      case 'aggregate':
        return await col.aggregate(data).toArray();
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }
}
