import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Browse from './pages/Browse.jsx';
import Saved from './pages/Saved.jsx';
import Provider from './pages/Provider.jsx';
import ComingSoon from './pages/ComingSoon.jsx';

function Protected({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <div style={{ padding: 32 }}><div className="skeleton" style={{ height: 28, width: 180 }} /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Shell /></Protected>}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="browse" element={<Browse />} />
        <Route path="saved" element={<Saved />} />
        <Route path="p/:id" element={<Provider />} />
        <Route path="bookings" element={<ComingSoon title="Bookings" />} />
        <Route path="profile" element={<ComingSoon title="Profile" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
