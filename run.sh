#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

# Activate virtual environment
if [ -d "$DIR/.venv" ]; then
    source "$DIR/.venv/bin/activate"
fi

# Detect local IP
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n1 || echo "127.0.0.1")
PORT=8000

if [ "$1" == "--ssl" ]; then
    PROTOCOL="https"
    SSL_FLAGS="--ssl-keyfile data/key.pem --ssl-certfile data/cert.pem"
else
    PROTOCOL="http"
    SSL_FLAGS=""
fi

echo "=========================================================="
echo "  🥗 DietCraft - Recipe, Meal Planner & Shopping App"
echo "=========================================================="
echo "  💻 Linux Desktop:  ${PROTOCOL}://localhost:${PORT}"
echo "  📱 Android Phone:  ${PROTOCOL}://${LOCAL_IP}:${PORT}"
echo "=========================================================="
echo "  📲 To Install on Android (Chrome):"
echo "     1. On your phone, visit: chrome://flags"
echo "     2. Search: 'unsafely-treat-insecure-origin-as-secure'"
echo "     3. Paste: http://${LOCAL_IP}:${PORT}"
echo "     4. Enable & Relaunch, then tap 'Install app'!"
echo "     (Or simply use Firefox for Android: tap menu -> Install)"
echo "=========================================================="
echo "Starting DietCraft server on 0.0.0.0:${PORT}..."

exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} $SSL_FLAGS
