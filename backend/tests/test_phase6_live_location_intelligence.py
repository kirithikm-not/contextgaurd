"""
Phase 6 Live Network-Level Location Intelligence & Impossible Travel Tests
Verifies haversine distance calculation, impossible travel detection thresholding,
known location tracking, and real login risk evaluation integration.
"""
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.geolocation import (
    haversine_distance_km,
    check_impossible_travel,
    check_is_known_location,
    geolocate_ip,
)
from database import SessionLocal
from models import User, LoginHistory


@pytest.fixture
def client():
    return TestClient(app)


def test_haversine_formula_distance():
    # Ashburn, Virginia (39.0438, -77.4874) to South Brisbane, Australia (-27.4766, 153.0166)
    # Expected great-circle distance is ~15,500 km
    dist = haversine_distance_km(39.0438, -77.4874, -27.4766, 153.0166)
    assert 15000.0 < dist < 16000.0

    # Distance to self must be 0
    assert haversine_distance_km(37.7749, -122.4194, 37.7749, -122.4194) == 0.0


def test_geolocate_ip_loopback():
    geo = geolocate_ip("127.0.0.1")
    assert geo["status"] == "success"
    assert geo["country"] == "Local Network"
    assert geo["is_vpn_or_proxy"] is False


def test_impossible_travel_thresholding():
    db = SessionLocal()
    try:
        user_id = "usr_travel_unit_test"
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(
                id=user_id,
                email="travel_unit@contextguard.local",
                hashed_password="mock",
                created_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(user)
            db.commit()

        # Seed initial login in New York 10 minutes ago
        ten_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
        initial_login = LoginHistory(
            id="log_unit_test_01",
            user_id=user_id,
            ip_address="198.51.100.1",
            geo_country="United States",
            geo_city="New York",
            latitude=40.7128,
            longitude=-74.0060,
            is_vpn_or_proxy=False,
            created_at=ten_mins_ago.isoformat(),
        )
        db.merge(initial_login)
        db.commit()

        now = datetime.now(timezone.utc)

        # 1. Nearby login (Brooklyn ~10km away in 10 mins) -> < 900 km/h -> False
        is_impossible = check_impossible_travel(
            user_id=user_id,
            new_lat=40.6782,
            new_lon=-73.9442,
            new_timestamp=now,
            db=db,
        )
        assert is_impossible is False

        # 2. Transcontinental login (London ~5,500km away in 10 mins -> ~33,000 km/h) -> True
        is_impossible_transcontinental = check_impossible_travel(
            user_id=user_id,
            new_lat=51.5074,
            new_lon=-0.1278,
            new_timestamp=now,
            db=db,
        )
        assert is_impossible_transcontinental is True
    finally:
        db.close()


def test_login_endpoint_live_location_evaluation(client):
    # Register test user
    email = "live_location_test@contextguard.local"
    user_id = "usr_live_loc_test"
    client.post("/api/auth/register", json={"email": email, "password": "Password123!", "user_id": user_id})

    # Login 1
    res1 = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    assert res1.status_code == 200
    data1 = res1.json()
    assert "location_signals" in data1
    assert "impossible_travel_flag" in data1["location_signals"]
    assert data1["location_signals"]["impossible_travel_flag"] is False
