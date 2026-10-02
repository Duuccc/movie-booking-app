from typing import List, Optional
from pydantic import BaseModel


class DailyRevenuePoint(BaseModel):
    date: str
    revenue: int


class TopMovie(BaseModel):
    movie_id: int
    title: str
    revenue: int
    bookings_count: int


class FormatRevenue(BaseModel):
    format: str
    revenue: int


class AnalyticsOut(BaseModel):
    window_days: int
    total_revenue: int
    total_bookings: int
    total_tickets_sold: int
    cancellation_rate: float
    average_order_value: int
    average_occupancy: float
    revenue_change_pct: Optional[float]
    bookings_change_pct: Optional[float]
    daily_revenue: List[DailyRevenuePoint]
    top_movies: List[TopMovie]
    revenue_by_format: List[FormatRevenue]