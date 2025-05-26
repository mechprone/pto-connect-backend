const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySupabaseToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw new Error(error.message);
  return data.user;
}

module.exports = {
  supabase,
  verifySupabaseToken
};