// Test Supabase connection and verify tables exist
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zbqvfubmlauotxcaemit.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicXZmdWJtbGF1b3R4Y2FlbWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODAyMTY2MSwiZXhwIjoyMTAzNTk3NjYxfQ.KbfYh58D03JtcKkdqukr0NIecYbtruIgTUB-SePYpu8'

const db = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

async function testConnection() {
  console.log('Testing Supabase connection...')
  console.log('URL:', SUPABASE_URL)
  console.log('Key:', SUPABASE_SERVICE_ROLE_KEY ? 'Present' : 'Missing')
  
  try {
    // Try to query the startups table
    console.log('\nTrying to query startups table...')
    const { data, error } = await db.from('startups').select('*').limit(1)
    
    if (error) {
      console.error('Error querying startups:', error.message)
      console.error('Error details:', JSON.stringify(error, null, 2))
    } else {
      console.log('Success! Startups table exists.')
      console.log('Data:', data)
    }
    
    // Try to list all tables by querying information_schema
    console.log('\nTrying to list all tables...')
    const { data: tables, error: tablesError } = await db
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      console.error('Error listing tables:', tablesError.message)
    } else {
      console.log('Tables in public schema:', tables?.map(t => t.table_name))
    }
    
  } catch (e) {
    console.error('Exception:', e.message)
  }
}

testConnection()
