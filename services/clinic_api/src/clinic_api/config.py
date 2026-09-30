from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://kasauti:kasauti@localhost:5432/clinic"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
