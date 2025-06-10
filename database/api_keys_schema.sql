-- API Keys Management System
-- Phase 2 Week 2 Day 7-8: Security Framework

-- API Keys table for third-party integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id VARCHAR(32) UNIQUE NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  permissions JSONB DEFAULT '{}',
  rate_limit_tier VARCHAR(20) DEFAULT 'standard',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Key usage tracking for analytics and monitoring
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  ip_address INET,
  user_agent TEXT,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_id ON api_keys(key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_status_code ON api_key_usage(status_code);

-- Row Level Security (RLS) policies for API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

-- API Keys policies - users can only access keys for their organization
CREATE POLICY api_keys_org_isolation ON api_keys
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- API Key usage policies - users can only access usage data for their organization's keys
CREATE POLICY api_key_usage_org_isolation ON api_key_usage
  FOR ALL
  USING (
    api_key_id IN (
      SELECT ak.id FROM api_keys ak
      JOIN profiles p ON ak.org_id = p.org_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Function to generate secure API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
  key_id TEXT;
  key_secret TEXT;
  full_key TEXT;
BEGIN
  -- Generate random key ID (8 characters)
  key_id := encode(gen_random_bytes(4), 'hex');
  
  -- Generate random key secret (32 characters)
  key_secret := encode(gen_random_bytes(16), 'hex');
  
  -- Combine with separator
  full_key := key_id || '.' || key_secret;
  
  RETURN full_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to hash API key secret
CREATE OR REPLACE FUNCTION hash_api_key_secret(secret TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(secret, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create API key with proper hashing
CREATE OR REPLACE FUNCTION create_api_key(
  p_name VARCHAR(100),
  p_description TEXT DEFAULT NULL,
  p_org_id UUID,
  p_created_by UUID,
  p_permissions JSONB DEFAULT '{}',
  p_rate_limit_tier VARCHAR(20) DEFAULT 'standard',
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  api_key_id UUID,
  full_api_key TEXT,
  key_id VARCHAR(32)
) AS $$
DECLARE
  v_full_key TEXT;
  v_key_id VARCHAR(32);
  v_key_secret TEXT;
  v_key_hash TEXT;
  v_api_key_id UUID;
BEGIN
  -- Generate the API key
  v_full_key := generate_api_key();
  
  -- Split the key
  v_key_id := split_part(v_full_key, '.', 1);
  v_key_secret := split_part(v_full_key, '.', 2);
  
  -- Hash the secret
  v_key_hash := hash_api_key_secret(v_key_secret);
  
  -- Insert the API key record
  INSERT INTO api_keys (
    key_id,
    key_hash,
    name,
    description,
    org_id,
    created_by,
    permissions,
    rate_limit_tier,
    expires_at
  ) VALUES (
    v_key_id,
    v_key_hash,
    p_name,
    p_description,
    p_org_id,
    p_created_by,
    p_permissions,
    p_rate_limit_tier,
    p_expires_at
  ) RETURNING id INTO v_api_key_id;
  
  -- Return the results
  RETURN QUERY SELECT v_api_key_id, v_full_key, v_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_full_key TEXT)
RETURNS TABLE(
  api_key_id UUID,
  org_id UUID,
  permissions JSONB,
  rate_limit_tier VARCHAR(20),
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_key_id VARCHAR(32);
  v_key_secret TEXT;
  v_key_hash TEXT;
  v_api_key_record RECORD;
BEGIN
  -- Split the key
  v_key_id := split_part(p_full_key, '.', 1);
  v_key_secret := split_part(p_full_key, '.', 2);
  
  -- Validate key format
  IF v_key_id = '' OR v_key_secret = '' OR length(v_key_id) != 8 OR length(v_key_secret) != 32 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, NULL::VARCHAR(20), false, 'Invalid API key format';
    RETURN;
  END IF;
  
  -- Hash the secret
  v_key_hash := hash_api_key_secret(v_key_secret);
  
  -- Find the API key
  SELECT ak.* INTO v_api_key_record
  FROM api_keys ak
  WHERE ak.key_id = v_key_id 
    AND ak.key_hash = v_key_hash 
    AND ak.is_active = true;
  
  -- Check if key exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, NULL::VARCHAR(20), false, 'Invalid or inactive API key';
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_api_key_record.expires_at IS NOT NULL AND v_api_key_record.expires_at < NOW() THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::JSONB, NULL::VARCHAR(20), false, 'API key has expired';
    RETURN;
  END IF;
  
  -- Return valid key info
  RETURN QUERY SELECT 
    v_api_key_record.id,
    v_api_key_record.org_id,
    v_api_key_record.permissions,
    v_api_key_record.rate_limit_tier,
    true,
    'Valid'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record API key usage
CREATE OR REPLACE FUNCTION record_api_key_usage(
  p_api_key_id UUID,
  p_endpoint VARCHAR(255),
  p_method VARCHAR(10),
  p_status_code INTEGER,
  p_response_time_ms INTEGER,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_size_bytes INTEGER DEFAULT NULL,
  p_response_size_bytes INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO api_key_usage (
    api_key_id,
    endpoint,
    method,
    status_code,
    response_time_ms,
    ip_address,
    user_agent,
    request_size_bytes,
    response_size_bytes
  ) VALUES (
    p_api_key_id,
    p_endpoint,
    p_method,
    p_status_code,
    p_response_time_ms,
    p_ip_address,
    p_user_agent,
    p_request_size_bytes,
    p_response_size_bytes
  );
  
  -- Update last used timestamp
  UPDATE api_keys 
  SET last_used_at = NOW() 
  WHERE id = p_api_key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE api_keys IS 'API keys for third-party integrations with role-based permissions';
COMMENT ON TABLE api_key_usage IS 'Usage tracking and analytics for API keys';
COMMENT ON FUNCTION generate_api_key() IS 'Generates a secure API key in format: keyid.secret';
COMMENT ON FUNCTION create_api_key(VARCHAR, TEXT, UUID, UUID, JSONB, VARCHAR, TIMESTAMP WITH TIME ZONE) IS 'Creates a new API key with proper security hashing';
COMMENT ON FUNCTION validate_api_key(TEXT) IS 'Validates an API key and returns key information';
COMMENT ON FUNCTION record_api_key_usage(UUID, VARCHAR, VARCHAR, INTEGER, INTEGER, INET, TEXT, INTEGER, INTEGER) IS 'Records API key usage for analytics and monitoring';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON api_keys TO authenticated;
GRANT SELECT, INSERT ON api_key_usage TO authenticated;
GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION create_api_key(VARCHAR, TEXT, UUID, UUID, JSONB, VARCHAR, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_api_key_usage(UUID, VARCHAR, VARCHAR, INTEGER, INTEGER, INET, TEXT, INTEGER, INTEGER) TO authenticated;
