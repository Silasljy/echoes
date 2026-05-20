import { z } from 'zod'

export const chatRequestSchema = z.object({
    role: z.string().min(1, 'role is required'),
    input: z.string().min(1, 'input is required').max(2000, 'input is too long'),
    mode: z.string().optional(),
    userId: z.string().optional()
})

export const historyGetSchema = z.object({
    role: z.string().min(1, 'role is required'),
    userId: z.string().optional().default('anon'),
    limit: z.preprocess((value) => {
        if (typeof value === 'string' && value.trim() !== '') {
            const num = Number(value)
            return Number.isNaN(num) ? undefined : num
        }
        return value
    }, z.number().int().min(1).max(100).optional().default(50))
})

export const historyDeleteSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    role: z.string().optional()
})

export const sessionEndSchema = z.object({
    userId: z.string().min(1, 'userId is required')
})
