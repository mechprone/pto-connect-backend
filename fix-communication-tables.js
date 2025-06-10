import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://ixpqvvnurmkqpedpemzd.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4cHF2dm51cm1rcXBlZHBlbXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNzg3NzI5NCwiZXhwIjoyMDMzNDUzMjk0fQ.VuaN2mmfrYuHOKpqpXkcFQVLl3KeVQFuFN95tqe4Edc'
);

async function createMissingTables() {
  console.log('🚀 Creating missing communication tables...');
  
  // Create sms_deliveries table
  const smsDeliveriesSQL = `
    CREATE TABLE IF NOT EXISTS sms_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE CASCADE,
      user_id UUID REFERENCES auth.users(id),
      phone_number VARCHAR(20),
      message_sid VARCHAR(100),
      status VARCHAR(50),
      error_code VARCHAR(10),
      error_message TEXT,
      sent_at TIMESTAMP WITH TIME ZONE,
      delivered_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  // Create email_campaigns table
  const emailCampaignsSQL = `
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      campaign_id UUID,
      template_id UUID REFERENCES email_templates(id),
      subject VARCHAR(500) NOT NULL,
      html_content TEXT NOT NULL,
      text_content TEXT,
      sender_name VARCHAR(255),
      sender_email VARCHAR(255),
      reply_to_email VARCHAR(255),
      recipient_count INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      opened_count INTEGER DEFAULT 0,
      clicked_count INTEGER DEFAULT 0,
      bounced_count INTEGER DEFAULT 0,
      unsubscribed_count INTEGER DEFAULT 0,
      open_rate DECIMAL(5,2) DEFAULT 0.00,
      click_rate DECIMAL(5,2) DEFAULT 0.00,
      bounce_rate DECIMAL(5,2) DEFAULT 0.00,
      status VARCHAR(50) DEFAULT 'draft',
      scheduled_for TIMESTAMP WITH TIME ZONE,
      sent_at TIMESTAMP WITH TIME ZONE,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  try {
    // Create sms_deliveries
    const { error: smsError } = await supabase.rpc('exec_sql', { sql: smsDeliveriesSQL });
    if (smsError) {
      console.log('SMS deliveries table:', smsError.message);
    } else {
      console.log('✅ SMS deliveries table created');
    }
    
    // Create email_campaigns
    const { error: emailError } = await supabase.rpc('exec_sql', { sql: emailCampaignsSQL });
    if (emailError) {
      console.log('Email campaigns table:', emailError.message);
    } else {
      console.log('✅ Email campaigns table created');
    }
    
    // Test all tables
    const tables = ['email_templates', 'sms_campaigns', 'sms_deliveries', 'push_notifications', 'email_campaigns'];
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Working`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

createMissingTables();
