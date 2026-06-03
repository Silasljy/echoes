import { z } from 'zod'

const parsePositiveNumber = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() !== '') {
        const num = Number(value)
        return Number.isNaN(num) ? undefined : num
    }
    return value
}, z.number().int().positive())

const parseBoundedNumber = z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() !== '') {
        const num = Number(value)
        return Number.isNaN(num) ? undefined : num
    }
    return value
}, z.number().int().positive().max(200))

export const chatRequestSchema = z.object({
    role: z.string().min(1, 'role is required'),
    input: z.string().min(1, 'input is required').max(2000, 'input is too long'),
    mode: z.string().optional(),
    userId: z.string().optional(),
    debateTopic: z.string().max(2000, 'debateTopic is too long').optional(),
    debateContext: z.string().max(20000, 'debateContext is too long').optional(),
    reverseTopic: z.string().max(2000, 'reverseTopic is too long').optional(),
    reverseStage: z.string().max(32, 'reverseStage is too long').optional()
})

export const historyGetSchema = z.object({
    role: z.string().min(1, 'role is required'),
    userId: z.string().optional().default('anon'),
    page: parsePositiveNumber.optional().default(1),
    pageSize: parsePositiveNumber.optional().default(50),
    limit: parseBoundedNumber.optional()
})

export const historyDeleteSchema = z.object({
    userId: z.string().min(1, 'userId is required'),
    role: z.string().optional()
})

export const sessionEndSchema = z.object({
    userId: z.string().min(1, 'userId is required')
})
