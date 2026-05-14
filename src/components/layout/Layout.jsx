import React from 'react'
import Routers from '../routers/Routers'
import { BrowserRouter as Router } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthProvider'

function Layout() {
  return (
    <Router>
      <AuthProvider>
        <Routers />
      </AuthProvider>
    </Router>
  )
}

export default Layout
