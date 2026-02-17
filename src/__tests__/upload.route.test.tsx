import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { strToU8, zipSync } from 'fflate'
import { vi } from 'vitest'

import { Upload } from '../routes/upload'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: { component: unknown }) => config,
  useNavigate: () => vi.fn(),
  useSearch: () => ({ updateSlug: undefined }),
}))

const publishMock = vi.fn()
const getUploadUrlMock = vi.fn()
const getExistingMock = vi.fn()
const generateChangelogPreviewMock = vi.fn()
const fetchMock = vi.fn()
const useAuthStatusMock = vi.fn()

vi.mock('../lib/api', () => ({
  skillsApi: {
    publish: (...args: unknown[]) => publishMock(...args),
    getExisting: (...args: unknown[]) => getExistingMock(...args),
    generateChangelogPreview: (...args: unknown[]) => generateChangelogPreviewMock(...args),
  },
  personasApi: {
    publish: vi.fn(),
    getExisting: vi.fn(),
    generateChangelogPreview: vi.fn(),
  },
  uploadApi: {
    getUploadUrl: (...args: unknown[]) => getUploadUrlMock(...args),
  },
}))

vi.mock('../lib/useAuthStatus', () => ({
  useAuthStatus: () => useAuthStatusMock(),
}))

vi.mock('../lib/site', () => ({
  getSiteMode: () => 'skills',
}))

describe('Upload route', () => {
  beforeEach(() => {
    publishMock.mockReset()
    getUploadUrlMock.mockReset()
    getExistingMock.mockReset()
    generateChangelogPreviewMock.mockReset()
    fetchMock.mockReset()
    useAuthStatusMock.mockReset()

    useAuthStatusMock.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      me: { _id: 'users:1', handle: 'testuser' },
    })
    getExistingMock.mockResolvedValue(null)
    generateChangelogPreviewMock.mockResolvedValue({ changelog: '' })
    getUploadUrlMock.mockResolvedValue({ url: 'https://upload.local', storageKey: 'key-1' })
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows validation issues before submit', async () => {
    render(<Upload />)
    const publishButton = screen.getByRole('button', { name: /publish/i })
    expect(publishButton.getAttribute('disabled')).not.toBeNull()
    expect(screen.getByText(/Slug is required/i)).toBeTruthy()
    expect(screen.getByText(/Display name is required/i)).toBeTruthy()
  })

  it('marks the input for folder uploads', async () => {
    render(<Upload />)
    const input = screen.getByTestId('upload-input')
    await waitFor(() => {
      expect(input.getAttribute('webkitdirectory')).not.toBeNull()
    })
  })

  it('enables publish when fields and files are valid', async () => {
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('skill-name'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My skill'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, stable'), {
      target: { value: 'latest' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    expect(await screen.findByText(/All checks passed/i)).toBeTruthy()
    expect(publishButton.getAttribute('disabled')).toBeNull()
  })

  it('extracts zip uploads and unwraps top-level folders', async () => {
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('skill-name'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My skill'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, stable'), {
      target: { value: 'latest' },
    })

    const zip = zipSync({
      'hetzner-cloud-skill/SKILL.md': new Uint8Array(strToU8('hello')),
      'hetzner-cloud-skill/notes.txt': new Uint8Array(strToU8('notes')),
    })
    const zipBytes = Uint8Array.from(zip).buffer
    const zipFile = new File([zipBytes], 'bundle.zip', { type: 'application/zip' })

    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [zipFile] } })

    expect(await screen.findByText('notes.txt', {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText('SKILL.md')).toBeTruthy()
    expect(await screen.findByText(/All checks passed/i, {}, { timeout: 3000 })).toBeTruthy()
  })

  it('unwraps folder uploads so SKILL.md can be at the top-level', async () => {
    publishMock.mockResolvedValue({ slug: 'ynab' })
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('skill-name'), {
      target: { value: 'ynab' },
    })
    fireEvent.change(screen.getByPlaceholderText('My skill'), {
      target: { value: 'YNAB' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.0.0' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, stable'), {
      target: { value: 'latest' },
    })

    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    Object.defineProperty(file, 'webkitRelativePath', { value: 'ynab/SKILL.md' })

    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText('SKILL.md')).toBeTruthy()
    expect(await screen.findByText(/All checks passed/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() => {
      expect(publishMock).toHaveBeenCalled()
    })
    const args = publishMock.mock.calls[0]
    // First arg is slug, second is the publish body
    expect(args[0]).toBe('ynab')
    const body = args[1] as { files?: Array<{ path: string }> }
    expect(body?.files?.[0]?.path).toBe('SKILL.md')
  })

  it('blocks non-text folder uploads (png)', async () => {
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('skill-name'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My skill'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, stable'), {
      target: { value: 'latest' },
    })

    const skill = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const png = new File([new Uint8Array([137, 80, 78, 71]).buffer], 'screenshot.png', {
      type: 'image/png',
    })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [skill, png] } })

    expect(await screen.findByText('screenshot.png')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    expect(await screen.findByText(/Remove non-text files: screenshot\.png/i)).toBeTruthy()
    expect(screen.getByText('screenshot.png')).toBeTruthy()
  })

  it('surfaces publish errors and stays on page', async () => {
    publishMock.mockRejectedValueOnce(new Error('Changelog is required'))
    render(<Upload />)
    fireEvent.change(screen.getByPlaceholderText('skill-name'), {
      target: { value: 'cool-skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('My skill'), {
      target: { value: 'Cool Skill' },
    })
    fireEvent.change(screen.getByPlaceholderText('1.0.0'), {
      target: { value: '1.2.3' },
    })
    fireEvent.change(screen.getByPlaceholderText('latest, stable'), {
      target: { value: 'latest' },
    })
    fireEvent.change(screen.getByPlaceholderText('Describe what changed in this skill...'), {
      target: { value: 'Initial drop.' },
    })
    const file = new File(['hello'], 'SKILL.md', { type: 'text/markdown' })
    const input = screen.getByTestId('upload-input') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })
    const publishButton = screen.getByRole('button', { name: /publish/i }) as HTMLButtonElement
    await screen.findByText(/All checks passed/i)
    fireEvent.click(publishButton)
    expect(await screen.findByText(/Changelog is required/i)).toBeTruthy()
  })
})
