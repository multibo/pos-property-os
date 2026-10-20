import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthScreen } from '../AuthScreen'

const baseProps = {
  configured: true,
  loading: false,
  error: null,
  message: null,
  onAuthenticate: vi.fn().mockResolvedValue(undefined),
}

describe('AuthScreen', () => {
  it('explains configuration is required and prevents fake sign-in', () => {
    render(<AuthScreen {...baseProps} configured={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Supabase setup required')
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('validates email and password before invoking authentication', async () => {
    const onAuthenticate = vi.fn().mockResolvedValue(undefined)
    render(<AuthScreen {...baseProps} onAuthenticate={onAuthenticate} />)
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(onAuthenticate).not.toHaveBeenCalled()
  })

  it('submits sign-in credentials and exposes sign-up mode', async () => {
    const onAuthenticate = vi.fn().mockResolvedValue(undefined)
    render(<AuthScreen {...baseProps} onAuthenticate={onAuthenticate} />)
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), { target: { value: 'correct horse battery' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(onAuthenticate).toHaveBeenCalledWith('sign-in', 'person@example.com', 'correct horse battery', ''))
    fireEvent.click(screen.getByRole('button', { name: /create an account/i }))
    expect(screen.getByRole('heading', { name: /make space for better/i })).toBeInTheDocument()
  })
})
