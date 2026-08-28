from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Application
    app_env: str = "development"
    log_level: str = "INFO"
    pipeline_interval_minutes: int = 15

    # Supabase
    supabase_url: str = "your_supabase_url_here"
    supabase_anon_key: str = "your_anon_key_here"
    supabase_service_key: str = "your_service_role_key_here"

    # Google Gemini
    gemini_api_key: str = "your_gemini_api_key_here"

    # Firebase Cloud Messaging
    firebase_project_id: str = ""
    firebase_service_account_json: str = ""

    # Pipeline
    similarity_threshold: float = 0.75
    max_articles_per_feed: int = 20
    gemini_rpm_limit: int = 15
    gemini_delay_between_calls: float = 13.0

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
