import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MovieListPage from './pages/MovieListPage'
import MovieDetailsPage from './pages/MovieDetailsPage'
import ShowtimeSelectionPage from './pages/ShowtimeSelectionPage'
import SeatSelectionPage from './pages/SeatSelectionPage'
import BookingConfirmationPage from './pages/BookingConfirmationPage'
import MyBookingsPage from './pages/MyBookingsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminMoviesPage from './pages/AdminMoviesPage'
import AdminTheatersPage from './pages/AdminTheatersPage'
import AdminShowtimesPage from './pages/AdminShowtimesPage'
import AdminBookingsPage from './pages/AdminBookingsPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<MovieListPage />} />
          <Route path="/movies/:movieId" element={<MovieDetailsPage />} />
          <Route path="/movies/:movieId/showtimes" element={<ShowtimeSelectionPage />} />
          <Route
            path="/showtimes/:showtimeId/seats"
            element={
              <ProtectedRoute>
                <SeatSelectionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings/:bookingId/confirmation"
            element={
              <ProtectedRoute>
                <BookingConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/movies"
            element={
              <AdminRoute>
                <AdminMoviesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/theaters"
            element={
              <AdminRoute>
                <AdminTheatersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/showtimes"
            element={
              <AdminRoute>
                <AdminShowtimesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <AdminRoute>
                <AdminBookingsPage />
              </AdminRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App