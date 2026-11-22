import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import RealtimeBridge from './components/RealtimeBridge';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EventDetail from './pages/EventDetail';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import Dashboard from './pages/organizer/Dashboard';
import EventForm from './pages/organizer/EventForm';
import EventManage from './pages/organizer/EventManage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <RealtimeBridge />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/checkout/:bookingId" element={<ProtectedRoute role="CUSTOMER"><Checkout /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute role="CUSTOMER"><MyBookings /></ProtectedRoute>} />
          <Route path="/organizer" element={<ProtectedRoute role="ORGANIZER"><Dashboard /></ProtectedRoute>} />
          <Route path="/organizer/events/new" element={<ProtectedRoute role="ORGANIZER"><EventForm /></ProtectedRoute>} />
          <Route path="/organizer/events/:id/edit" element={<ProtectedRoute role="ORGANIZER"><EventForm /></ProtectedRoute>} />
          <Route path="/organizer/events/:id" element={<ProtectedRoute role="ORGANIZER"><EventManage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
