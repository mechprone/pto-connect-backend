// Check if event_workflows table exists
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iuqwjvjwjxdlcvjkqgvx.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1cXdqdmp3anhkbGN2amtxZ3Z4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNjU5NjgzNCwiZXhwIjoyMDQyMTcyODM0fQ.lMSVjCNpW9qzpIuPYFWsELNsv9LdHKxNVEFLNnmf0ak';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkEventWorkflowsTable() {
  try {
    console.log('🔍 Checking event_workflows table...');
    
    // Try to query the table structure
    const { data, error } = await supabase
      .from('event_workflows')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ event_workflows table error:', error);
      return;
    }
    
    console.log('✅ event_workflows table exists');
    console.log('📊 Sample data (if any):', data);
    
    // Check table schema by trying to insert a test record (then delete it)
    console.log('🧪 Testing table schema...');
    const testData = {
      event_id: '00000000-0000-0000-0000-000000000000', // This will fail but show us what columns are required
      org_id: '00000000-0000-0000-0000-000000000000',
      workflow_name: 'Schema Test',
      workflow_type: 'test'
    };
    
    const { data: insertData, error: insertError } = await supabase
      .from('event_workflows')
      .insert(testData)
      .select();
    
    if (insertError) {
      console.log('📋 Schema validation error (expected):', insertError.message);
      console.log('💡 This tells us what columns/constraints exist');
    } else {
      console.log('⚠️ Unexpected success - test record created:', insertData);
      // Clean up test record if it was actually created
      if (insertData && insertData[0]) {
        await supabase
          .from('event_workflows')
          .delete()
          .eq('id', insertData[0].id);
        console.log('🧹 Cleaned up test record');
      }
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

checkEventWorkflowsTable(); 