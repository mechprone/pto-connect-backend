import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function createReconciliationTables() {
  console.log('🚀 Creating reconciliation tables...');
  
  try {
    // Test if tables already exist by trying to select from them
    console.log('Checking if reconciliation tables exist...');
    
    const { data: existingReconciliations, error: checkError } = await supabase
      .from('reconciliations')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Reconciliation tables already exist!');
      return;
    }
    
    console.log('Tables do not exist, need to create them manually in Supabase dashboard...');
    console.log('❌ Cannot create tables programmatically with current Supabase setup');
    console.log('Please run the SQL from reconciliation_schema.sql in the Supabase SQL editor');
    
  } catch (error) {
    console.error('❌ Migration check failed:', error);
  }
}

createReconciliationTables();
