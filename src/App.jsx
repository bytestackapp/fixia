import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Shell from './components/Shell.jsx';
import Login from './pages/Login.jsx';
import Forgot from './pages/Forgot.jsx';
import Reset from './pages/Reset.jsx';
import { SignupChoice, SignupCustomer, SignupProvider } from './pages/Signup.jsx';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Browse from './pages/Browse.jsx';
import Saved from './pages/Saved.jsx';
import Provider from './pages/Provider.jsx';
import Bookings from './pages/Bookings.jsx';
import Notifications from './pages/Notifications.jsx';
import Profile from './pages/Profile.jsx';
import Checkout from './pages/Checkout.jsx';
import PaymentReturn from './pages/PaymentReturn.jsx';
import SignupReturn from './pages/SignupReturn.jsx';
import AdminShell from './pages/admin/AdminShell.jsx';
import Overview from './pages/admin/Overview.jsx';
import Pending from './pages/admin/Pending.jsx';
import Providers from './pages/admin/Providers.jsx';
import Customers from './pages/admin/Customers.jsx';
import Upgrades from './pages/admin/Upgrades.jsx';
import Requests from './pages/admin/Requests.jsx';
import Reports from './pages/admin/Reports.jsx';
import Uncategorized from './pages/admin/Uncategorized.jsx';
import Suspicious from './pages/admin/Suspicious.jsx';
import Packages from './pages/admin/Packages.jsx';
import Fees from './pages/admin/Fees.jsx';
import Ads from './pages/admin/Ads.jsx';
import Messages from './pages/admin/Messages.jsx';
import Settings from './pages/admin/Settings.jsx';

const Splash = () => <div style={{ padding: 32 }}><div className="skeleton" style={{ height: 28, width: 180 }} /></div>;

function Gate({ role, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/" replace />;
  if (role === 'member' && user.role === 'admin' && !sessionStorage.getItem('fixia.adminView')) return <Navigate to="/admin" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/signup" element={<SignupChoice />} />
      <Route path="/signup/customer" element={<SignupCustomer />} />
      <Route path="/signup/provider" element={<SignupProvider />} />
      <Route path="/signup/return" element={<SignupReturn />} />

      <Route element={<Gate role="member"><Shell /></Gate>}>
        <Route index element={<Home />} />
        <Route path="search" element={<Search />} />
        <Route path="browse" element={<Browse />} />
        <Route path="saved" element={<Saved />} />
        <Route path="p/:id" element={<Provider />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="checkout/:id" element={<Checkout />} />
        <Route path="payment/return" element={<PaymentReturn />} />
      </Route>

      <Route path="admin" element={<Gate role="admin"><AdminShell /></Gate>}>
        <Route index element={<Overview />} />
        <Route path="pending" element={<Pending />} />
        <Route path="providers" element={<Providers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="upgrades" element={<Upgrades />} />
        <Route path="requests" element={<Requests />} />
        <Route path="reports" element={<Reports />} />
        <Route path="uncategorized" element={<Uncategorized />} />
        <Route path="suspicious" element={<Suspicious />} />
        <Route path="packages" element={<Packages />} />
        <Route path="fees" element={<Fees />} />
        <Route path="ads" element={<Ads />} />
        <Route path="messages" element={<Messages />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
