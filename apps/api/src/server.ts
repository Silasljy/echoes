import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import app from './app'

// Load .env from apps/api/.env if present, otherwise fallback to root .env
const root = process.cwd()
const apiEnv = path.join(root, 'apps', 'api', '.env')
const rootEnv = path.join(root, '.env')
if (fs.existsSync(apiEnv)) {
    dotenv.config({ path: apiEnv })
    console.log(`Loaded environment from ${apiEnv}`)
} else if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv })
    console.log(`Loaded environment from ${rootEnv}`)
} else {
    console.log('No .env file found; relying on process environment variables')
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000

app.listen(PORT, () => {
    console.log(`Echoes API running on http://localhost:${PORT}`)
})
