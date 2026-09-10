"""
Central place for reading configuration from environment variables / .env.

Kept as one small file so it's obvious where every setting comes from.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://movieuser:moviepass@localhost:5432/moviebooking"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", case_sensitive=False)


settings = Settings()