import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lkdhtdqxlcfsjiqqedph.supabase.co'
const supabaseKey = 'sb_publishable_HG__MG-zzB5vCNrCVMXCLw_inLZUN4Q'

export const supabase = createClient(supabaseUrl, supabaseKey)