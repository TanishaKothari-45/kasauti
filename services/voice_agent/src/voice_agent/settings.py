from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
