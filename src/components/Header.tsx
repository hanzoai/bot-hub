import { Link } from '@tanstack/react-router'
import { Menu, Monitor, Moon, Sun } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useAuthContext } from '../lib/AuthContext'
import { gravatarUrl } from '../lib/gravatar'
import { isModerator } from '../lib/roles'
import { getSiteName } from '../lib/site'
import { applyTheme, useThemeMode } from '../lib/theme'
import { startThemeTransition } from '../lib/theme-transition'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

export default function Header() {
  const { user: me, isAuthenticated, loading: isLoading, signIn, signOut } = useAuthContext()
  const { mode, setMode } = useThemeMode()
  const toggleRef = useRef<HTMLDivElement | null>(null)
  const siteName = useMemo(() => getSiteName(), [])

  const avatar = me?.image ?? (me?.email ? gravatarUrl(me.email) : undefined)
  const handle = me?.handle ?? me?.displayName ?? 'user'
  const initial = (me?.displayName ?? handle).charAt(0).toUpperCase()
  const isStaff = isModerator(me)
  const signInRedirectTo = getCurrentRelativeUrl()

  const setTheme = (next: 'system' | 'light' | 'dark') => {
    startThemeTransition({
      nextTheme: next,
      currentTheme: mode,
      setTheme: (value) => {
        const nextMode = value as 'system' | 'light' | 'dark'
        applyTheme(nextMode)
        setMode(nextMode)
      },
      context: { element: toggleRef.current },
    })
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link
          to="/"
          search={{ q: undefined, highlighted: undefined, search: undefined }}
          className="brand"
        >
          <span className="brand-mark">
            <img src="/hanzo-logo.svg" alt="" aria-hidden="true" />
          </span>
          <span className="brand-name">{siteName}</span>
        </Link>
        <nav className="nav-links">
          <Link
            to="/skills"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              highlighted: undefined,
              nonSuspicious: undefined,
              view: undefined,
              focus: undefined,
            }}
          >
            Skills
          </Link>
          <Link
            to="/personas"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              view: undefined,
              focus: undefined,
            }}
          >
            Personas
          </Link>
          <Link to="/upload" search={{ updateSlug: undefined }}>
            Upload
          </Link>
          <Link to="/import">Import</Link>
          <Link
            to="/skills"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              highlighted: undefined,
              nonSuspicious: undefined,
              view: undefined,
              focus: 'search',
            }}
          >
            Search
          </Link>
          {me ? <Link to="/stars">Stars</Link> : null}
          {isStaff ? (
            <Link to="/management" search={{ skill: undefined }}>
              Management
            </Link>
          ) : null}
        </nav>
        <div className="nav-actions">
          <div className="nav-mobile">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-mobile-trigger" type="button" aria-label="Open menu">
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link
                    to="/skills"
                    search={{
                      q: undefined,
                      sort: undefined,
                      dir: undefined,
                      highlighted: undefined,
                      nonSuspicious: undefined,
                      view: undefined,
                      focus: undefined,
                    }}
                  >
                    Skills
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/personas"
                    search={{
                      q: undefined,
                      sort: undefined,
                      dir: undefined,
                      view: undefined,
                      focus: undefined,
                    }}
                  >
                    Personas
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/upload" search={{ updateSlug: undefined }}>
                    Upload
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/import">Import</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/skills"
                    search={{
                      q: undefined,
                      sort: undefined,
                      dir: undefined,
                      highlighted: undefined,
                      nonSuspicious: undefined,
                      view: undefined,
                      focus: 'search',
                    }}
                  >
                    Search
                  </Link>
                </DropdownMenuItem>
                {me ? (
                  <DropdownMenuItem asChild>
                    <Link to="/stars">Stars</Link>
                  </DropdownMenuItem>
                ) : null}
                {isStaff ? (
                  <DropdownMenuItem asChild>
                    <Link to="/management" search={{ skill: undefined }}>
                      Management
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                  System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  Dark
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="theme-toggle" ref={toggleRef}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (!value) return
                setTheme(value as 'system' | 'light' | 'dark')
              }}
              aria-label="Theme mode"
            >
              <ToggleGroupItem value="system" aria-label="System theme">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">System</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="Light theme">
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Light</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Dark</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {isAuthenticated && me ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="user-trigger" type="button">
                  {avatar ? (
                    <img src={avatar} alt={me.displayName ?? 'User avatar'} />
                  ) : (
                    <span className="user-menu-fallback">{initial}</span>
                  )}
                  <span className="mono">@{handle}</span>
                  <span className="user-menu-chevron">▾</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              disabled={isLoading}
              onClick={() => signIn()}
            >
              <span className="sign-in-label">Sign in</span>
              <span className="sign-in-provider">with Hanzo</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}

function getCurrentRelativeUrl() {
  if (typeof window === 'undefined') return '/'
  return `${window.location.pathname}${window.location.search}${window.location.hash}`
}
