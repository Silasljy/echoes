import express, { NextFunction, Request, Response } from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import chatRouter from './routes/chat'
import rolesRouter from './routes/roles'
import historyRouter from './routes/history'
import sessionRouter from './routes/session'
import { ApiError } from './errors'

const app = express()

app.set('trust proxy', true)
app.use(cors())
app.use(morgan('tiny'))
app.use(bodyParser.json())

// Rate limiting — protect against accidental or intentional request bursts
const generalLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
})

const chatLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'too_many_requests' },
})

app.use('/health', generalLimiter)
app.use('/roles', generalLimiter)
app.use('/history', generalLimiter)
app.use('/session', generalLimiter)
app.use('/chat', chatLimiter)

app.use('/chat', chatRouter)
app.use('/roles', rolesRouter)
app.use('/history', historyRouter)
app.use('/session', sessionRouter)

app.get('/health', (req, res) => res.json({ status: 'ok' }))

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err)
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({ error: err.message })
    }

    if (err instanceof Error) {
        return res.status(500).json({ error: err.message || 'internal_error' })
    }

    return res.status(500).json({ error: 'internal_error' })
})

export default app
