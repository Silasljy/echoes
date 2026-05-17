import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import app from './app'

// Load .env relative to this file so PM2/Node cwd does not matter.
const candidateEnvPaths = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(process.cwd(), 'apps', 'api', '.env'),
    path.resolve(process.cwd(), '.env'),
]

const loadedEnvPath = candidateEnvPaths.find((envPath) => fs.existsSync(envPath))
if (loadedEnvPath) {
    dotenv.config({ path: loadedEnvPath })
    console.log(`Loaded environment from ${loadedEnvPath}`)
} else {
    console.log('No .env file found; relying on process environment variables')
}

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000

app.listen(PORT, () => {
    console.log(`Echoes API running on http://localhost:${PORT}`)
})
