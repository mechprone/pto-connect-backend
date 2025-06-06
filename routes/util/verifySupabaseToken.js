import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Verifies the provided Supabase token and returns the associated user.
 * @param {string} token - Supabase JWT token from Authorization header.
 * @returns {Promise<object>} - Supabase user object.
 */
export async function verifySupabaseToken(token) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser(token);

  if (error) throw new Error(error.message);
  return user;
}

export { supabase };