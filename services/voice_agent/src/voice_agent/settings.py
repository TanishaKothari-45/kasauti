from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_api_key: str = ""
    groq_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    whisper_model: str = "mlx-community/whisper-large-v3-turbo"
    # Which speech-to-text engine runs when a request doesn't choose: "local" | "groq".
    stt_provider: str = "local"
    cors_origins: list[str] = ["http://localhost:3000"]


settings = Settings()
