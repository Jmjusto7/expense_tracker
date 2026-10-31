import { getInstallState, promptInstall } from './installPrompt'
import { newId } from './rekey'

describe('install prompt', () => {
    it('becomes available when the browser offers it, and is used once', async () => {
        const event = new Event('beforeinstallprompt', { cancelable: true })
        event.prompt = vi.fn()
        event.userChoice = Promise.resolve({ outcome: 'accepted' })
        window.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
        expect(getInstallState().status).toBe('available')
        expect(await promptInstall()).toBe('accepted')
        expect(event.prompt).toHaveBeenCalledTimes(1)
        expect(getInstallState().status).not.toBe('available')
        expect(await promptInstall()).toBe('dismissed')
    })
})

describe('newId', () => {
    it('falls back to getRandomValues where randomUUID is missing (plain http)', () => {
        const original = crypto.randomUUID
        Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
        try {
            const id = newId()
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
            expect(newId()).not.toBe(id)
        } finally {
            Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
        }
    })
})
