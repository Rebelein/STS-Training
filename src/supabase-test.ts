import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gwflwxznnfzvlwsweyjo.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3Zmx3eHpubmZ6dmx3c3dleWpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTI2MTcsImV4cCI6MjA5Mjk2ODYxN30.lhVzDPyES5ZIY9oZrxvVkmhuDg0Z0KnTux8gBJbS9jI";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: g, error: ge } = await supabase.from('groups').select('*').limit(1);
  console.log("Groups columns:", g && g.length ? Object.keys(g[0] || {}) : "No data", "Error:", ge);
  
  const { data: e, error: ee } = await supabase.from('events').select('*').limit(1);
  console.log("Events columns:", e && e.length ? Object.keys(e[0] || {}) : "No data", "Error:", ee);
}
check();
