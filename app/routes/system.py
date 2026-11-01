import socket
from fastapi import APIRouter, Request
from typing import Dict, Any

from ..database import get_db_connection

router = APIRouter(prefix="/api/system", tags=["system"])

def get_local_ip() -> str:
    """Attempts to determine the local LAN IP address of this Linux machine."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Connecting to a public IP retrieves the active routing interface IP (e.g. 192.168.1.42)
        s.connect(('1.1.1.1', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

@router.get("/info")
def get_system_info(request: Request):
    ip = get_local_ip()
    port = request.url.port or 8000
    scheme = request.url.scheme or "http"
    
    mobile_url = f"{scheme}://{ip}:{port}"
    localhost_url = f"{scheme}://localhost:{port}"

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM recipes")
    recipes_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM meal_plans")
    meals_count = cursor.fetchone()["count"]

    cursor.execute("SELECT COUNT(*) as count FROM shopping_lists")
    lists_count = cursor.fetchone()["count"]

    cursor.execute("SELECT key, value FROM settings")
    settings = {r["key"]: r["value"] for r in cursor.fetchall()}

    conn.close()

    return {
        "local_ip": ip,
        "port": port,
        "scheme": scheme,
        "mobile_url": mobile_url,
        "localhost_url": localhost_url,
        "stats": {
            "recipes": recipes_count,
            "meals_planned": meals_count,
            "shopping_lists": lists_count
        },
        "settings": settings
    }

@router.post("/settings")
def update_settings(settings: Dict[str, str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in settings.items():
        cursor.execute("""
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """, (k, v))
    conn.commit()
    conn.close()
    return {"message": "Settings updated"}
