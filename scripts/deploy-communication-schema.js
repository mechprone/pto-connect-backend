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

const schema = {
  name: 'communications_templates',
  sql: `
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

    -- Create indexes for communications_templates
    CREATE INDEX IF NOT EXISTS idx_communications_templates_org_id ON communications_templates(org_id);
    CREATE INDEX IF NOT EXISTS idx_communications_templates_category ON communications_templates(category);
    CREATE INDEX IF NOT EXISTS idx_communications_templates_created_by ON communications_templates(created_by);
    CREATE INDEX IF NOT EXISTS idx_communications_templates_is_shared ON communications_templates(is_shared) WHERE is_shared = true;

    -- Enable Row Level Security
    ALTER TABLE communications_templates ENABLE ROW LEVEL SECURITY;

    -- RLS Policies for communications_templates
    CREATE POLICY "Users can view communications templates in their organization" ON communications_templates
      FOR SELECT USING (org_id IN (
        SELECT org_id FROM user_organizations WHERE user_id = auth.uid()
      ));

    CREATE POLICY "Committee leads can manage communications templates" ON communications_templates
      FOR ALL USING (
        org_id IN (
          SELECT org_id FROM user_organizations 
          WHERE user_id = auth.uid() 
          AND role IN ('admin', 'committee_lead', 'president', 'vice_president', 'secretary', 'treasurer')
        )
      );

    -- Create function to update updated_at column if it doesn't exist
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Create trigger for updated_at
    CREATE TRIGGER update_communications_templates_updated_at 
      BEFORE UPDATE ON communications_templates 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();

    -- Grant necessary permissions
    GRANT SELECT, INSERT, UPDATE, DELETE ON communications_templates TO authenticated;
  `
};

async function deploySchema() {
  try {
    console.log('🚀 Starting communication schema deployment...');

    // Execute the schema creation
    const { error } = await supabase.rpc('exec_sql', { sql: schema.sql });

    if (error) {
      console.error('❌ Error deploying schema:', error);
      return;
    }

    console.log('✅ Communication schema deployed successfully!');
    console.log('📋 Tables created:');
    console.log('   - communications_templates');
    console.log('📋 Features:');
    console.log('   - Row Level Security enabled');
    console.log('   - Automatic updated_at timestamps');
    console.log('   - Proper indexing for performance');
    console.log('   - Organization-based access control');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
  }
}

deploySchema();
