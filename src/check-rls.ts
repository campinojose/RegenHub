import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltan variables de entorno para Supabase")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies')
  
  if (error) {
    // Si no existe la función rpc, podemos intentar otra cosa, o simplemente usar sql puro pero el cliente JS no expone .query()
    console.error("No se pudo obtener las políticas vía rpc:", error)
  } else {
    console.log(data)
  }
}

checkPolicies()
