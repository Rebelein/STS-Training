import { createClient } from "@supabase/supabase-js";

// These variables must be set in .env or via secrets.
// We provide fallback empty strings to prevent instant crashes if not set,
// but the client will fail when trying to fetch data if they are empty.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gwflwxznnfzvlwsweyjo.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Zmx3eHpubmZ6dmx3c3dleWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTI2MTcsImV4cCI6MjA5Mjk2ODYxN30.lhVzDPyES5ZIY9oZrxvVkmhuDg0Z0KnTux8gBJbS9jI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const hasSupabaseConfig = () => {
  return supabaseUrl !== "" && supabaseAnonKey !== "";
};
