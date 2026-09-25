from typing import List
from pydantic import BaseModel


class DailyRevenuePoint(BaseModel):
    date: str
    revenue: int


class TopMovie(BaseModel):
    movie_id: int
    title: str
    revenue: int
    bookings_count: int


class AnalyticsOut(BaseModel):
    window_days: int
    total_revenue: int
    average_occupancy: float
    daily_revenue: List[DailyRevenuePoint]
    top_movies: List[TopMovie]