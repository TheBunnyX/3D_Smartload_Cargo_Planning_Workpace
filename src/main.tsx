import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Login } from './components/Login'
import { AUTH_USER, endSession, getSession } from './lib/auth'
import './styles.css'

function Root() {
  const [user, setUser] = useState(getSession)
  if (!user) return <Login onLogin={() => setUser(getSession() ?? AUTH_USER)}/>
  return <App user={user} onLogout={() => { endSession(); setUser(null) }}/>
}

createRoot(document.getElementById('root')!).render(<Root/>)
