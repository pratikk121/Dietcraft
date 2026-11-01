#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=========================================================="
echo "  🥗 DietCraft - Next.js + Supabase PWA"
echo "=========================================================="
echo "  💻 Local URL:  http://localhost:3000"
echo "  ☁️  Vercel:     Deploy with 'npx vercel' or push to GitHub"
echo "  🗄️  Database:   Supabase PostgreSQL (schema.sql)"
echo "=========================================================="

npm run dev
