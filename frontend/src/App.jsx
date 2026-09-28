import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import CheckoutPage from './pages/CheckoutPage'
import MyBookingsPage from './pages/MyBookingsPage'
import AdminMoviesPage from './pages/AdminMoviesPage'
import AdminTheatersPage from './pages/AdminTheatersPage'
import AdminShowtimesPage from './pages/AdminShowtimesPage'
import AdminBookingsPage from './pages/AdminBookingsPage'
import ShowtimesPage from './pages/ShowtimesPage'
import AdminAnalyticsPage from './pages/AdminAnalyticsPage'
import AdminLayout from './components/AdminLayout'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<MovieListPage />} />
          <Route path="/showtimes" element={<ShowtimesPage />} />
          <Route path="/movies/:movieId" element={<MovieDetailsPage />} />
          <Route path="/movies/:movieId/showtimes" element={<ShowtimeSelectionPage />} />
          <Route
            path="/showtimes/:showtimeId/seats"
            element={
                <SeatSelectionPage />
            }
          />
          <Route
            path='/bookings/:bookingId/checkout'
            element={
              <ProtectedRoute>
                <CheckoutPage></CheckoutPage>
              </ProtectedRoute>
            }></Route>
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
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="analytics" replace />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="movies" element={<AdminMoviesPage />} />
            <Route path="theaters" element={<AdminTheatersPage />} />
            <Route path="showtimes" element={<AdminShowtimesPage />} />
            <Route path="bookings" element={<AdminBookingsPage />} />
          </Route>

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App