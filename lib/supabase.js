import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Supabase 클라이언트 초기화 (Singleton 패턴)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
