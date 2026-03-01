import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lkdhtdqxlcfsjiqqedph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZGh0ZHF4bGNmc2ppcXFlZHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MDYyOTMsImV4cCI6MjA4NzM4MjI5M30.TCukk29-cVmP0fquc6pVh4fGa-J5IV920f59a7vraKc'

export const supabase = createClient(supabaseUrl, supabaseKey)