// Simple script to load .env and check for DEEPSEEK_API_KEY
import 'dotenv/config'
const key = process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API || null
if (!key) {
    console.error('DEEPSEEK_API_KEY not found in environment or .env')
    process.exit(2)
}
const masked = key.length > 8 ? key.slice(0, 4) + '...' + key.slice(-4) : key
console.log('DEEPSEEK_API_KEY found, masked:', masked)
process.exit(0)
