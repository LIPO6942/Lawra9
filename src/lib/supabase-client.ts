
'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing in environment variables.');
}

const isTokenExpired = (token: string): boolean => {
  try {
    const { exp } = jwtDecode(token);
    if (!exp) return true;
    const expirationTime = exp * 1000; // Convert to milliseconds
    const now = new Date().getTime();
    return now >= expirationTime;
  } catch (error) {
    console.error('Error decoding token:', error);
    return true; // Treat decoding errors as an expired token
  }
};

let supabaseClientInstance: SupabaseClient | null = null;
let currentToken: string | null = null;

export const getSupabaseClient = (token: string): SupabaseClient => {
  if (supabaseClientInstance && currentToken && currentToken === token && !isTokenExpired(token)) {
    return supabaseClientInstance;
  }

  // Create a new client if one doesn't exist, the token has changed, or the token is expired.
  supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  
  currentToken = token;

  return supabaseClientInstance;
};
