FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY services/clinic_api ./services/clinic_api
RUN uv pip install --system ./services/clinic_api
EXPOSE 8000
CMD ["uvicorn", "clinic_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
