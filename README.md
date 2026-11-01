# 🥗 DietCraft

A modern, cross-platform personal diet engine, recipe database, monthly meal planner, and supermarket shopping tracker engineered for **Linux (Fedora)** and **Android**.

---

## 🚀 Quick Start

To launch DietCraft:

```bash
cd /home/pratik/Projects/Apps/diet
./run.sh
```

- **Linux Desktop URL:** [http://localhost:8000](http://localhost:8000)
- **Android Phone URL:** `http://<YOUR_LOCAL_IP>:8000` (The launcher automatically prints your exact IP address and port on startup)

You can also launch it directly from your Fedora application launcher using the included [`diet.desktop`](file:///home/pratik/Projects/Apps/diet/diet.desktop).

---

## 📱 Using on Android (Full-Screen Native App Experience)

DietCraft is built as an offline-capable **Progressive Web App (PWA)**:

1. Connect your Android phone to the same home Wi-Fi network as your Fedora PC.
2. In DietCraft on your PC, click **"Pair Android Phone"** to display the QR code.
3. Scan the QR code with your phone camera or enter the LAN URL into **Chrome** or **Firefox** on your phone.
4. Tap the **⋮ (three dots)** menu in Chrome and tap **"Install app"** or **"Add to Home screen"**.
5. DietCraft will now launch with its own app icon, full-screen without browser bars, and with touch-optimized mobile navigation.

---

## 🌟 Key Features

### 1. 📖 Recipe Database
- Create, edit, and categorize recipes (Breakfast, Lunch, Dinner, Snack, Dessert).
- Interactive ingredient builder: specify quantities, units (`g`, `kg`, `ml`, `l`, `pcs`, `cups`, etc.), and supermarket aisle categories (`Produce`, `Dairy`, `Meat`, `Pantry`, `Spices`, etc.).
- Servings scaling: each recipe has a default serving size, which scales automatically when added to your meal plan.
- Ships with 5 chef-crafted starter recipes ready to use.

### 2. 📅 Monthly & Weekly Meal Planner
- Full 30-day visual calendar grid and weekly views.
- Color-coded meal slots: Breakfast (Amber), Lunch (Blue), Dinner (Green), Snack (Purple).
- **⚡ 1-Click Auto-Plan:** Automatically populates your month or week with balanced meals from your recipe library.
- Custom meals & dining out support: enter freeform titles (e.g., "Leftovers" or "Dinner with friends").

### 3. 🛒 Monthly Shopping List Generator
- Aggregates ingredients across all planned meals for any custom date range (e.g., full month or week).
- **Intelligent unit scaling & normalization:** scales by servings and combines quantities (e.g., 200g + 300g = 500g, or converts grams to kilograms if $\ge 1000\text{g}$).
- Organized by supermarket aisles (`Produce`, `Meat/Seafood`, `Dairy`, `Bakery`, `Pantry`, etc.) so you can walk straight down grocery aisles efficiently.
- Add extra household or one-off items anytime (detergent, olive oil, coffee, snacks).

### 4. 🏷️ Live Supermarket Shopping Mode & Price Learning
- Designed for one-handed mobile phone use inside the supermarket.
- Large touch-friendly checkboxes to cross off items as you drop them in your cart.
- **Real-time Price Entry:** type the price you paid directly beside the item on your phone.
- **Budget Tracking:** displays a live running total of what you have spent vs. estimated budget.
- **Price Learning Engine:** every price you enter is saved into `price_history`. Future monthly grocery lists will automatically use your latest recorded local prices to calculate accurate budget forecasts!

---

## 🗄️ Database & Storage

All data is stored in a clean, zero-configuration SQLite database:
- Path: `data/diet.db`
- Self-contained, easy to backup, copy, or sync.
