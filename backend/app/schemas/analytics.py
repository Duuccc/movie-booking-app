from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime as datetime_type

class DailyRevenuePoint(BaseModel):
    date: str
    revenue: int


class TopMovie(BaseModel):
    movie_id: int
    title: str
    revenue: int


class FormatRevenue(BaseModel):
    format: str
    revenue: int


class SeatTypeRevenue(BaseModel):
    seat_type: str
    revenue: int


class TheaterRevenue(BaseModel):
    theater_id: int
    theater_name: str
    revenue: int


class HourlyBookings(BaseModel):
    hour: int
    bookings_count: int


class WeekdayBookings(BaseModel):
    weekday: str
    bookings_count: int


class AnalyticsOut(BaseModel):
    date_from: str
    date_to: str
    total_revenue: int
    total_bookings: int
    total_tickets_sold: int
    cancellation_rate: float
    average_order_value: int
    revenue_change_pct: Optional[float]
    bookings_change_pct: Optional[float]
    daily_revenue: List[DailyRevenuePoint]
    top_movies: List[TopMovie]
    revenue_by_format: List[FormatRevenue]
    revenue_by_seat_type: List[SeatTypeRevenue]
    revenue_by_theater: List[TheaterRevenue]
    peak_hours: List[HourlyBookings]
    bookings_by_weekday: List[WeekdayBookings]

class ShowtimePerformance(BaseModel):
    showtime_id: int
    start_time: datetime_type
    movie_title: str
    theater_name: str
    format: str
    booked_seats: int
    total_seats: int
    occupancy_pct: float