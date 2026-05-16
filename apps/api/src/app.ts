import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import chatRouter from './routes/chat'

const app = express()

app.use(cors())
app.use(bodyParser.json())

app.use('/chat', chatRouter)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

export default app
