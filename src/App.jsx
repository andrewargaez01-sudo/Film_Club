import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import FilmsOfMonth from './pages/FilmsOfMonth'
import Discussion from './pages/Discussion'
import PostDetail from './pages/PostDetail'
import Suggestions from './pages/Suggestions'
import Profile from './pages/Profile'
import Admin from './pages/Admin'

function App() {
  return (
    <>
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/film-of-the-month" element={<FilmsOfMonth />} />
          <Route path="/discussion" element={<Discussion />} />
          <Route path="/discussion/:id" element={<PostDetail />} />
          <Route path="/suggestions" element={<Suggestions />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
    </>
  )
}

export default App