
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL and Anon Key are not defined in .env file. Please check your environment variables.');
    // We throw an error because the app cannot function without Supabase.
    // In a real-world scenario, you might handle this more gracefully.
    throw new Error('Supabase client failed to initialize: Missing URL or Key.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
