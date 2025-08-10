import { config } from "dotenv";
import { query } from "../src/lib/db";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function initializeDatabase() {
  try {
    console.log("🚀 Initializing database...");
    console.log("📡 Testing database connection...");

    // Test connection first
    await query("SELECT NOW()");
    console.log("✅ Database connection successful!");

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Users table created successfully");

    // Create products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("✅ Products table created successfully");

    // Insert sample data for users
    await query(`
      INSERT INTO users (name, email) VALUES 
      ('John Doe', 'john@example.com'),
      ('Jane Smith', 'jane@example.com')
      ON CONFLICT (email) DO NOTHING
    `);

    console.log("✅ Sample users inserted");

    // Insert sample data for products
    await query(`
      INSERT INTO products (name, description, price) VALUES 
      ('Laptop', 'High-performance laptop for developers', 999.99),
      ('Mouse', 'Wireless ergonomic mouse', 29.99),
      ('Keyboard', 'Mechanical keyboard with RGB lighting', 149.99)
      ON CONFLICT DO NOTHING
    `);

    console.log("✅ Sample products inserted");
    console.log("🎉 Database initialization complete!");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
  } finally {
    process.exit();
  }
}

initializeDatabase();
