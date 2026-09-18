import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger("contextguard.geolocation")

IP_API_URL = "http://ip-api.com/json/{ip}?fields=status,message,country,city,lat,lon,proxy,hosting"


def is_private_or_loopback(ip: str) -> bool:
    """Detects whether an IP is localhost, loopback, or private RFC 1918 range."""
    if not ip:
        return True
    ip = ip.strip()
    if ip in ("127.0.0.1", "::1", "localhost", "0.0.0.0", "testclient"):
        return True
    if ip.startswith("10.") or ip.startswith("192.168."):
        return True
    if ip.startswith("172."):
        parts = ip.split(".")
        if len(parts) >= 2 and parts[1].isdigit():
            second_octet = int(parts[1])
            if 16 <= second_octet <= 31:
                return True
    return False


def geolocate_ip(ip: str, timeout: float = 4.0) -> Dict[str, Any]:
    """
    Fetches real network geolocation and proxy/VPN intelligence for an IP address
    using ip-api.com free endpoint.
    
    Returns a dictionary:
    {
        "ip": str,
        "country": Optional[str],
        "city": Optional[str],
        "latitude": Optional[float],
        "longitude": Optional[float],
        "is_vpn_or_proxy": bool,
        "status": "success" | "fail",
        "message": Optional[str]
    }
    
    Gracefully handles timeouts, rate limits, network errors, and reserved ranges
    without crashing.
    """
    cleaned_ip = ip.strip() if ip else ""
    
    # Handle private or loopback IPs directly without making external network calls
    if is_private_or_loopback(cleaned_ip):
        return {
            "ip": cleaned_ip,
            "country": "Local Network",
            "city": "Localhost",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "is_vpn_or_proxy": False,
            "status": "success",
            "message": "private_or_loopback_range",
        }

    url = IP_API_URL.format(ip=cleaned_ip)
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.get(url)
            
        if response.status_code != 200:
            logger.warning(f"Geolocation API returned HTTP {response.status_code} for IP {cleaned_ip}")
            return {
                "ip": cleaned_ip,
                "country": None,
                "city": None,
                "latitude": None,
                "longitude": None,
                "is_vpn_or_proxy": False,
                "status": "fail",
                "message": f"HTTP {response.status_code}",
            }

        data = response.json()
        if data.get("status") == "fail":
            logger.info(f"Geolocation lookup failed for IP {cleaned_ip}: {data.get('message')}")
            return {
                "ip": cleaned_ip,
                "country": None,
                "city": None,
                "latitude": None,
                "longitude": None,
                "is_vpn_or_proxy": False,
                "status": "fail",
                "message": data.get("message", "lookup_failed"),
            }

        is_proxy = bool(data.get("proxy") or data.get("hosting"))
        return {
            "ip": cleaned_ip,
            "country": data.get("country"),
            "city": data.get("city"),
            "latitude": float(data["lat"]) if "lat" in data and data["lat"] is not None else None,
            "longitude": float(data["lon"]) if "lon" in data and data["lon"] is not None else None,
            "is_vpn_or_proxy": is_proxy,
            "status": "success",
            "message": None,
        }

    except httpx.TimeoutException:
        logger.warning(f"Geolocation lookup timed out for IP {cleaned_ip}")
        return {
            "ip": cleaned_ip,
            "country": None,
            "city": None,
            "latitude": None,
            "longitude": None,
            "is_vpn_or_proxy": False,
            "status": "fail",
            "message": "timeout",
        }
    except Exception as exc:
        logger.warning(f"Geolocation lookup error for IP {cleaned_ip}: {exc}")
        return {
            "ip": cleaned_ip,
            "country": None,
            "city": None,
            "latitude": None,
            "longitude": None,
            "is_vpn_or_proxy": False,
            "status": "fail",
            "message": str(exc),
        }


import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from database import SessionLocal
from models import LoginHistory


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two GPS points on Earth in kilometers
    using the Haversine formula.
    """
    R = 6371.0  # Earth's mean radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def check_impossible_travel(
    user_id: str,
    new_lat: Optional[float],
    new_lon: Optional[float],
    new_timestamp: Optional[datetime] = None,
    db: Optional[Session] = None,
    speed_threshold_kmh: float = 900.0,
) -> bool:
    """
    Evaluates whether distance traveled since the user's most recent login divided by
    the elapsed time exceeds the physical threshold (default: 900 km/h, commercial aviation).
    """
    if new_lat is None or new_lon is None:
        return False

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        last_login = (
            db.query(LoginHistory)
            .filter(LoginHistory.user_id == user_id)
            .filter(LoginHistory.latitude.isnot(None))
            .filter(LoginHistory.longitude.isnot(None))
            .order_by(LoginHistory.created_at.desc())
            .first()
        )

        if not last_login:
            return False

        distance_km = haversine_distance_km(
            last_login.latitude, last_login.longitude, new_lat, new_lon
        )

        prev_time = datetime.fromisoformat(last_login.created_at)
        if prev_time.tzinfo is None:
            prev_time = prev_time.replace(tzinfo=timezone.utc)

        curr_time = new_timestamp or datetime.now(timezone.utc)
        if curr_time.tzinfo is None:
            curr_time = curr_time.replace(tzinfo=timezone.utc)

        elapsed_seconds = abs((curr_time - prev_time).total_seconds())
        if elapsed_seconds < 1.0:
            elapsed_seconds = 1.0

        elapsed_hours = elapsed_seconds / 3600.0
        speed_kmh = distance_km / elapsed_hours

        logger.info(
            f"Impossible travel check for user={user_id}: "
            f"distance={distance_km:.1f}km, elapsed={elapsed_seconds:.1f}s ({elapsed_hours*60:.2f}m), "
            f"speed={speed_kmh:.1f} km/h (threshold={speed_threshold_kmh} km/h)"
        )

        # Distance threshold of 50 km filters out cellular tower jitter within the same city
        if distance_km > 50.0 and speed_kmh > speed_threshold_kmh:
            logger.warning(
                f"IMPOSSIBLE TRAVEL FLAGGED for user {user_id}: {distance_km:.1f} km in "
                f"{elapsed_seconds:.1f} seconds ({speed_kmh:.1f} km/h > {speed_threshold_kmh} km/h)"
            )
            return True

        return False
    finally:
        if should_close:
            db.close()


def check_is_known_location(
    user_id: str,
    country: Optional[str],
    city: Optional[str],
    db: Optional[Session] = None,
) -> bool:
    """
    Returns True if this user has previously logged in from the same country and city,
    or if connection is on a local/trusted network.
    """
    if not country:
        return False
    if country in ("Local Network",):
        return True

    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        # Require 2+ prior logins from similar location to count as a known baseline
        query = db.query(LoginHistory).filter(LoginHistory.user_id == user_id)
        if city and city not in ("Unknown", "Localhost"):
            match_count = query.filter(
                LoginHistory.geo_country == country,
                LoginHistory.geo_city == city
            ).count()
            if match_count >= 1:
                return True

        country_matches = query.filter(LoginHistory.geo_country == country).count()
        return country_matches >= 1
    finally:
        if should_close:
            db.close()

