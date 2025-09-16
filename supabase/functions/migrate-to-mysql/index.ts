import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting migration to MySQL...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize MySQL client
    const client = await new Client().connect({
      hostname: Deno.env.get('MYSQL_HOST')!,
      username: Deno.env.get('MYSQL_USERNAME')!,
      password: Deno.env.get('MYSQL_PASSWORD')!,
      db: Deno.env.get('MYSQL_DATABASE')!,
      port: parseInt(Deno.env.get('MYSQL_PORT') || '3306'),
    });

    console.log('Connected to MySQL database');

    // Create tables if they don't exist
    await createMySQLTables(client);

    // Migrate profiles
    console.log('Migrating profiles...');
    const { data: profiles } = await supabase.from('profiles').select('*');
    if (profiles) {
      for (const profile of profiles) {
        await client.execute(`
          INSERT IGNORE INTO profiles (id, user_id, full_name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `, [
          profile.id,
          profile.user_id,
          profile.full_name,
          profile.created_at,
          profile.updated_at
        ]);
      }
      console.log(`Migrated ${profiles.length} profiles`);
    }

    // Migrate user_roles
    console.log('Migrating user roles...');
    const { data: userRoles } = await supabase.from('user_roles').select('*');
    if (userRoles) {
      for (const role of userRoles) {
        await client.execute(`
          INSERT IGNORE INTO user_roles (id, user_id, role, created_at, updated_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          role.id,
          role.user_id,
          role.role,
          role.created_at,
          role.updated_at,
          role.created_by
        ]);
      }
      console.log(`Migrated ${userRoles.length} user roles`);
    }

    // Migrate clients
    console.log('Migrating clients...');
    const { data: clients } = await supabase.from('clients').select('*');
    if (clients) {
      for (const client_data of clients) {
        await client.execute(`
          INSERT IGNORE INTO clients (id, full_name, contract_amount, installment_period, first_payment, monthly_payment, remaining_amount, total_paid, deposit_paid, deposit_target, user_id, payment_day, contract_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          client_data.id,
          client_data.full_name,
          client_data.contract_amount,
          client_data.installment_period,
          client_data.first_payment,
          client_data.monthly_payment,
          client_data.remaining_amount,
          client_data.total_paid,
          client_data.deposit_paid,
          client_data.deposit_target,
          client_data.user_id,
          client_data.payment_day,
          client_data.contract_date,
          client_data.created_at,
          client_data.updated_at
        ]);
      }
      console.log(`Migrated ${clients.length} clients`);
    }

    // Migrate payments
    console.log('Migrating payments...');
    const { data: payments } = await supabase.from('payments').select('*');
    if (payments) {
      for (const payment of payments) {
        await client.execute(`
          INSERT IGNORE INTO payments (id, client_id, user_id, payment_number, original_amount, custom_amount, due_date, is_completed, completed_at, payment_type, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          payment.id,
          payment.client_id,
          payment.user_id,
          payment.payment_number,
          payment.original_amount,
          payment.custom_amount,
          payment.due_date,
          payment.is_completed,
          payment.completed_at,
          payment.payment_type,
          payment.created_at,
          payment.updated_at
        ]);
      }
      console.log(`Migrated ${payments.length} payments`);
    }

    // Migrate payment_receipts
    console.log('Migrating payment receipts...');
    const { data: receipts } = await supabase.from('payment_receipts').select('*');
    if (receipts) {
      for (const receipt of receipts) {
        await client.execute(`
          INSERT IGNORE INTO payment_receipts (id, client_id, payment_id, user_id, file_name, file_path, mime_type, file_size, uploaded_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          receipt.id,
          receipt.client_id,
          receipt.payment_id,
          receipt.user_id,
          receipt.file_name,
          receipt.file_path,
          receipt.mime_type,
          receipt.file_size,
          receipt.uploaded_at,
          receipt.created_at,
          receipt.updated_at
        ]);
      }
      console.log(`Migrated ${receipts.length} payment receipts`);
    }

    await client.close();
    console.log('Migration completed successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Migration completed successfully',
      migrated: {
        profiles: profiles?.length || 0,
        userRoles: userRoles?.length || 0,
        clients: clients?.length || 0,
        payments: payments?.length || 0,
        receipts: receipts?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function createMySQLTables(client: Client) {
  console.log('Creating MySQL tables...');

  // Create profiles table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL UNIQUE,
      full_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create user_roles table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS user_roles (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NOT NULL UNIQUE,
      role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_by CHAR(36)
    )
  `);

  // Create clients table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id CHAR(36) PRIMARY KEY,
      full_name TEXT NOT NULL,
      contract_amount DECIMAL(15,2) NOT NULL,
      installment_period INT NOT NULL,
      first_payment DECIMAL(15,2) NOT NULL,
      monthly_payment DECIMAL(15,2) NOT NULL,
      remaining_amount DECIMAL(15,2) DEFAULT 0,
      total_paid DECIMAL(15,2) DEFAULT 0,
      deposit_paid DECIMAL(15,2) DEFAULT 0,
      deposit_target DECIMAL(15,2) DEFAULT 50000,
      user_id CHAR(36) NOT NULL,
      payment_day INT NOT NULL DEFAULT 1,
      contract_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create payments table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS payments (
      id CHAR(36) PRIMARY KEY,
      client_id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      payment_number INT NOT NULL,
      original_amount DECIMAL(15,2) NOT NULL,
      custom_amount DECIMAL(15,2),
      due_date DATE NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_at TIMESTAMP NULL,
      payment_type TEXT NOT NULL DEFAULT 'monthly',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create payment_receipts table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS payment_receipts (
      id CHAR(36) PRIMARY KEY,
      client_id CHAR(36) NOT NULL,
      payment_id CHAR(36),
      user_id CHAR(36) NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  console.log('MySQL tables created successfully');
}