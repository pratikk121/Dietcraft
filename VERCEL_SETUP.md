# 🚀 Vercel & Supabase Deployment Guide

Deploying DietCraft to **Vercel** with a **Supabase** backend gives you:
- **100% Trusted Public HTTPS domain** (`https://your-app.vercel.app`).
- **Instant Android PWA Install:** Chrome & Firefox on Android will immediately recognize the app, show the native **"Install app"** banner, and install the real app icon directly into your phone's App Drawer.
- **Access Anywhere:** Check off groceries and enter supermarket prices from your phone using mobile data (4G/5G) inside any store.
- **Automatic Cloud Sync:** Recipes, meal plans, and grocery price history sync continuously between your Linux PC and phone.

---

## 🗄️ Step 1: Set Up Supabase (2 Minutes)

1. Go to [https://supabase.com](https://supabase.com) and create a free account (or log in).
2. Click **New Project**, name it `DietCraft`, set a database password, and choose your preferred region.
3. Once the project is created:
   - On the left sidebar, click **SQL Editor**.
   - Click **New query**.
   - Copy the entire contents of [`schema.sql`](./schema.sql) and paste it into the editor.
   - Click **Run** (green button).
   *This automatically creates all tables (recipes, ingredients, meal_plans, shopping_lists, shopping_items, price_history, settings) and seeds 5 starter recipes!*
4. Click **Project Settings** (gear icon) ➔ **API**:
   - Copy **Project URL**
   - Copy **Project API Key (`anon` / `public`)**

---

## ☁️ Step 2: Deploy to Vercel

### Option A: Via GitHub (Recommended)
1. Push this repository to your GitHub account:
   ```bash
   git remote add origin https://github.com/your-username/dietcraft.git
   git branch -M main
   git push -u origin main
   ```
2. Go to [https://vercel.com](https://vercel.com) ➔ Click **Add New Project**.
3. Import your `dietcraft` GitHub repository.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase Anon API key
5. Click **Deploy**!

### Option B: Deploy Directly via Terminal
Run inside this directory:
```bash
npx vercel
```
Follow the quick CLI prompts to log in and deploy. Then add your environment variables in the Vercel dashboard.

---

## 📱 Step 3: Install as Native App on Android

1. Open your new Vercel link (`https://your-diet-app.vercel.app`) in **Chrome** or **Firefox** on your phone.
2. Tap the **"📲 Install App"** button at the top header, or tap the browser **`⋮` (three dots) menu** ➔ **"Install app"**.
3. DietCraft will be installed onto your home screen and into your phone's App Drawer with its full icon and standalone window!
