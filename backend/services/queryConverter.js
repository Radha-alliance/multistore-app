// Query Converter Service - Converts SQL to MongoDB format
class QueryConverter {
  /**
   * Convert SQL SELECT query to MongoDB find() syntax
   * Example: SELECT * FROM accounts WHERE balance > 5000
   * Converts to: db.accounts.find({balance: {$gt: 5000}})
   */
  sqlToMongoDB(sqlQuery) {
    try {
      const query = sqlQuery.trim();

      // Simple SELECT * FROM table
      const simpleMatch = query.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s*;?\s*$/i);
      if (simpleMatch) {
        const collection = simpleMatch[1];
        return `db.${collection}.find({})`;
      }

      // SELECT * FROM table WHERE conditions
      const whereMatch = query.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\s*;?\s*$/i);
      if (whereMatch) {
        const collection = whereMatch[1];
        const conditions = whereMatch[2];
        const mongoFilter = this.convertWhereClause(conditions);
        return `db.${collection}.find(${mongoFilter})`;
      }

      // SELECT * FROM table LIMIT n
      const limitMatch = query.match(/^SELECT\s+\*\s+FROM\s+(\w+)\s+LIMIT\s+(\d+)\s*;?\s*$/i);
      if (limitMatch) {
        const collection = limitMatch[1];
        const limit = limitMatch[2];
        return `db.${collection}.find({}).limit(${limit})`;
      }

      // SELECT * FROM table WHERE conditions LIMIT n
      const whereLimitMatch = query.match(
        /^SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(.+?)\s+LIMIT\s+(\d+)\s*;?\s*$/i
      );
      if (whereLimitMatch) {
        const collection = whereLimitMatch[1];
        const conditions = whereLimitMatch[2];
        const limit = whereLimitMatch[3];
        const mongoFilter = this.convertWhereClause(conditions);
        return `db.${collection}.find(${mongoFilter}).limit(${limit})`;
      }

      // If no match, return original query (let MongoDB handle error message)
      return query;
    } catch (error) {
      return sqlQuery; // Return original on error
    }
  }

  /**
   * Convert SQL WHERE clause to MongoDB filter object
   * Examples:
   * - balance > 5000 => {balance: {$gt: 5000}}
   * - account_type = 'Checking' => {account_type: "Checking"}
   * - balance > 5000 AND status = 'Active' => {balance: {$gt: 5000}, status: "Active"}
   */
  convertWhereClause(whereClause) {
    try {
      const conditions = {};

      // Split by AND (case-insensitive)
      const parts = whereClause.split(/\s+AND\s+/i);

      for (const part of parts) {
        const trimmed = part.trim();

        // Handle: field > value
        let match = trimmed.match(/^(\w+)\s*>\s*(.+)$/);
        if (match) {
          const field = match[1];
          const value = this.parseValue(match[2]);
          conditions[field] = { $gt: value };
          continue;
        }

        // Handle: field < value
        match = trimmed.match(/^(\w+)\s*<\s*(.+)$/);
        if (match) {
          const field = match[1];
          const value = this.parseValue(match[2]);
          conditions[field] = { $lt: value };
          continue;
        }

        // Handle: field >= value
        match = trimmed.match(/^(\w+)\s*>=\s*(.+)$/);
        if (match) {
          const field = match[1];
          const value = this.parseValue(match[2]);
          conditions[field] = { $gte: value };
          continue;
        }

        // Handle: field <= value
        match = trimmed.match(/^(\w+)\s*<=\s*(.+)$/);
        if (match) {
          const field = match[1];
          const value = this.parseValue(match[2]);
          conditions[field] = { $lte: value };
          continue;
        }

        // Handle: field = value or field != value
        match = trimmed.match(/^(\w+)\s*(!?=)\s*(.+)$/);
        if (match) {
          const field = match[1];
          const operator = match[2];
          const value = this.parseValue(match[3]);

          if (operator === '!=') {
            conditions[field] = { $ne: value };
          } else {
            conditions[field] = value;
          }
        }
      }

      return JSON.stringify(conditions);
    } catch (error) {
      return '{}'; // Return empty filter on error
    }
  }

  /**
   * Parse a value - handle strings, numbers, booleans
   * 'text' => "text"
   * 123 => 123
   * true => true
   */
  parseValue(valueStr) {
    const trimmed = valueStr.trim();

    // String with quotes
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }

    // Number
    if (!isNaN(trimmed) && trimmed !== '') {
      return parseFloat(trimmed);
    }

    // Boolean
    if (trimmed.toLowerCase() === 'true') return true;
    if (trimmed.toLowerCase() === 'false') return false;

    // Default: treat as string
    return trimmed;
  }
}

module.exports = new QueryConverter();
