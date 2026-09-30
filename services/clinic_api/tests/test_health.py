from httpx import ASGITransport, AsyncClient

from clinic_api.main import app


async def test_health_reports_service_and_database():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
    body = response.json()
    assert response.status_code == 200
    assert body["service"] == "clinic_api"
    assert body["status"] == "ok"
