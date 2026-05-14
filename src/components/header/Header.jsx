import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-teal-100 text-teal-900' : 'text-slate-600 hover:bg-slate-100'}`

function Header() {
  const { user, signOut } = useAuth()

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/" className="text-lg font-semibold tracking-tight text-slate-900">
            Sidram <span className="text-teal-700">Khaata</span>
          </Link>
          {user && (
            <nav className="flex items-center gap-1">
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
              <NavLink to="/people" className={navClass}>
                People
              </NavLink>
            </nav>
          )}
        </div>
        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[12rem] truncate text-sm text-slate-600 sm:inline" title={user.email || ''}>
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
