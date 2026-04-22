import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  "https://izdkjxinkkebazpouudt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6ZGtqeGlua2tlYmF6cG91dWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NjIwMzAsImV4cCI6MjA5MjMzODAzMH0.kG1rlvN8RtnwOcaRAQ7hZqlTCEqP3aWcBfndSEzKoCM"
)

export default supabase