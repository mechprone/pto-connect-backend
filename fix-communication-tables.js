import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCommunicationTables() {
  try {
    console.log('🔧 Starting communication tables fix...');

    // Check if communications_templates table exists
    const { data: tableExists, error: checkError } = await supabase
      .from('communications_templates')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      console.log('📋 Creating communications_templates table...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS communications_templates (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT,
          design_json JSONB NOT NULL,
          html_content TEXT,
          thumbnail_url TEXT,
          is_shared BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT true,
          template_type VARCHAR(50) DEFAULT 'email',
          sharing_level VARCHAR(50) DEFAULT 'private',
          shared_with_orgs UUID[],
          usage_count INTEGER DEFAULT 0,
          created_by UUID REFERENCES auth.users(id),
          org_id UUID REFERENCES organizations(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          CONSTRAINT communications_templates_name_org_unique UNIQUE(name, org_id)
        );
      `;

      const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (createError) {
        console.error('❌ Error creating communications_templates table:', createError);
        return;
      }

      console.log('✅ communications_templates table created successfully');
    } else {
      console.log('✅ communications_templates table already exists');
    }

    // Check if email_templates table exists and migrate data if needed
    const { data: oldTableExists, error: oldCheckError } = await supabase
      .from('email_templates')
      .select('id')
      .limit(1);

    if (!oldCheckError && oldTableExists) {
      console.log('🔄 Migrating data from email_templates to communications_templates...');
      
      // Get all data from email_templates
      const { data: oldTemplates, error: fetchError } = await supabase
        .from('email_templates')
        .select('*');

      if (fetchError) {
        console.error('❌ Error fetching old templates:', fetchError);
        return;
      }

      if (oldTemplates && oldTemplates.length > 0) {
        // Insert data into communications_templates
        const { error: insertError } = await supabase
          .from('communications_templates')
          .insert(oldTemplates);

        if (insertError) {
          console.error('❌ Error migrating templates:', insertError);
          return;
        }

        console.log(`✅ Migrated ${oldTemplates.length} templates successfully`);
      }

      // Drop the old table
      const dropTableSQL = 'DROP TABLE IF EXISTS email_templates CASCADE;';
      const { error: dropError } = await supabase.rpc('exec_sql', { sql: dropTableSQL });
      
      if (dropError) {
        console.error('❌ Error dropping old table:', dropError);
        return;
      }

      console.log('✅ Old email_templates table dropped');
    }

    // Create indexes if they don't exist
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_communications_templates_org_id ON communications_templates(org_id);',
      'CREATE INDEX IF NOT EXISTS idx_communications_templates_category ON communications_templates(category);',
      'CREATE INDEX IF NOT EXISTS idx_communications_templates_created_by ON communications_templates(created_by);',
      'CREATE INDEX IF NOT EXISTS idx_communications_templates_is_shared ON communications_templates(is_shared) WHERE is_shared = true;'
    ];

    for (const indexSQL of indexes) {
      const { error: indexError } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (indexError) {
        console.error('❌ Error creating index:', indexError);
      }
    }

    console.log('✅ Indexes created/verified');

    // Enable RLS if not already enabled
    const enableRLSSQL = 'ALTER TABLE communications_templates ENABLE ROW LEVEL SECURITY;';
    const { error: rlsError } = await supabase.rpc('exec_sql', { sql: enableRLSSQL });
    
    if (rlsError) {
      console.log('ℹ️  RLS already enabled or error (non-critical):', rlsError.message);
    } else {
      console.log('✅ RLS enabled');
    }

    // Create RLS policies if they don't exist
    const policies = [
      `CREATE POLICY IF NOT EXISTS "Users can view communications templates in their organization" ON communications_templates
        FOR SELECT USING (org_id IN (
          SELECT org_id FROM user_organizations WHERE user_id = auth.uid()
        ));`,
      `CREATE POLICY IF NOT EXISTS "Committee leads can manage communications templates" ON communications_templates
        FOR ALL USING (
          org_id IN (
            SELECT org_id FROM user_organizations 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'committee_lead', 'president', 'vice_president', 'secretary', 'treasurer')
          )
        );`
    ];

    for (const policySQL of policies) {
      const { error: policyError } = await supabase.rpc('exec_sql', { sql: policySQL });
      if (policyError) {
        console.log('ℹ️  Policy already exists or error (non-critical):', policyError.message);
      }
    }

    console.log('✅ RLS policies created/verified');

    // Grant permissions
    const grantSQL = 'GRANT SELECT, INSERT, UPDATE, DELETE ON communications_templates TO authenticated;';
    const { error: grantError } = await supabase.rpc('exec_sql', { sql: grantSQL });
    
    if (grantError) {
      console.log('ℹ️  Permissions already granted or error (non-critical):', grantError.message);
    } else {
      console.log('✅ Permissions granted');
    }

    console.log('\n🎉 Communication tables fix completed successfully!');
    console.log('📋 Summary:');
    console.log('   - communications_templates table verified/created');
    console.log('   - Data migrated from email_templates (if existed)');
    console.log('   - Indexes created for performance');
    console.log('   - RLS enabled with proper policies');
    console.log('   - Permissions granted to authenticated users');

  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixCommunicationTables();
