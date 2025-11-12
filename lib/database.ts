import { Pool, PoolClient, PoolConfig } from 'pg';

// Database configuration
const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'traffic_user',
  password: process.env.DB_PASSWORD || 'secure_password',
  database: process.env.DB_NAME || 'traffic_violation_db',
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Get a connection from the pool
export async function getConnection(): Promise<PoolClient> {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

// Execute a query with automatic connection management
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getConnection();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute a transaction
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now');
    console.log('Database connected successfully:', result[0]?.now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Initialize database with schema
export async function initializeDatabase(): Promise<void> {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Cannot connect to database');
    }

    console.log('Database initialization complete');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Health check function
export async function healthCheck(): Promise<{
  database: 'healthy' | 'unhealthy';
  responseTime?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await query('SELECT 1');
    const responseTime = Date.now() - startTime;

    return {
      database: 'healthy',
      responseTime
    };
  } catch (error) {
    return {
      database: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Close all connections (for graceful shutdown)
export async function closeDatabase(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connections closed');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}

// Export the pool for advanced usage
export { pool };

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await closeDatabase();
  process.exit(0);
});