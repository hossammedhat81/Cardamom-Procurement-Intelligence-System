# Cardamom Procurement Intelligence — Static Website

> AI-Powered 30-Day Indian Cardamom Price Forecasting Dashboard  
> **GitHub Pages deployment** — no server, no build tools, pure HTML/CSS/JS

---

## 🚀 Quick Start

### Option 1: Open Locally
```bash
# Python
cd website
python -m http.server 8000
# Open http://localhost:8000

# Node.js
npx serve website
```

### Option 2: GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Source: Deploy from a branch
4. Branch: `main` → Folder: `/website`
5. Save — live at `https://<username>.github.io/<repo>/website/`

---

## 📁 Structure

```
website/
├── index.html                    # Main dashboard (single-page app)
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker (offline support)
├── assets/
│   ├── css/
│   │   ├── style.css             # Core styles (900+ lines)
│   │   ├── dark-theme.css        # Dark/light theme variables
│   │   └── animations.css        # Keyframes & scroll animations
│   ├── js/
│   │   ├── data-loader.js        # CSV parsing & sample data loading
│   │   ├── forecasting.js        # Forecast engine & what-if simulation
│   │   ├── charts.js             # Plotly.js chart renderers (4 types)
│   │   ├── pdf-export.js         # CSV & 4-page PDF export
│   │   └── main.js               # Core app logic & event handlers
│   ├── data/
│   │   ├── forecasts.json        # Pre-computed 30-day AI predictions
│   │   └── sample-data.json      # Dataset summary metadata
│   └── images/
│       └── favicon.svg           # SVG favicon (cardamom + chart)
└── pages/
    ├── about.html                # Model architecture & methodology
    ├── docs.html                 # Full usage documentation
    └── contact.html              # Contact form & FAQ
```

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Triple-Model AI** | TimesFM + LSTM-CNN-34 + XGBoost-v17 consensus |
| **30-Day Forecast** | Daily price, risk, and recommendation predictions |
| **Hero Card** | Optimal entry point with savings calculation |
| **4 Analytics Tabs** | Price trend, risk calendar, pie breakdown, confidence gauge |
| **Cost Calculator** | Real-time cost comparison with slider input |
| **What-If Analysis** | 9 adjustable parameters + 4 preset scenarios |
| **CSV/PDF Export** | Full table CSV + 4-page executive PDF report |
| **3 Currencies** | USD ($), SAR (ر.س), INR (₹) with live switching |
| **Dark/Light Theme** | Toggle with persistent preference |
| **PWA Ready** | Installable, offline-capable via service worker |
| **Responsive** | Mobile-first, works on all screen sizes |
| **Accessible** | ARIA labels, keyboard nav, reduced motion support |

---

## 🔧 Tech Stack

- **HTML5** — semantic markup
- **CSS3** — custom properties, glassmorphism, flexbox/grid
- **JavaScript ES6+** — modular IIFE architecture
- **Plotly.js 2.27** — interactive charts (CDN)
- **PapaParse 5.4** — CSV parsing (CDN)
- **jsPDF + AutoTable** — PDF generation (CDN)
- **Zero build tools** — no npm, no webpack, no bundler

---

## 📊 Updating Forecasts

To refresh the pre-computed forecasts from the Python backend:

```bash
# From the project root
python -c "
from utils.forecast_engine import ForecastEngine
import json

engine = ForecastEngine()
data = engine.generate_forecast(df)
# Convert to JSON and save
with open('website/assets/data/forecasts.json', 'w') as f:
    json.dump(data, f, indent=2)
"
```

The JSON must match the schema in `assets/data/forecasts.json`.

---

## 🌐 CDN Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| [Plotly.js](https://plotly.com/javascript/) | 2.27.0 | Interactive charts |
| [PapaParse](https://www.papaparse.com/) | 5.4.1 | CSV parsing |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | PDF generation |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.8.1 | PDF tables |
| [Inter Font](https://fonts.google.com/specimen/Inter) | Variable | Typography |

All loaded via CDN — no `node_modules` required.

---

## 📱 PWA Installation

The site is a Progressive Web App. On supported browsers:
1. Visit the deployed site
2. Click the browser's "Install" prompt (or three dots → Install App)
3. App appears on homescreen, works offline

---

## 🌐 GitHub Pages Deployment Guide

### Files to Upload

Upload **only** the `website/` folder contents:

```
website/
├── index.html                    ✅ REQUIRED
├── manifest.json                 ✅ REQUIRED
├── sw.js                         ✅ REQUIRED
├── assets/
│   ├── css/*.css                 ✅ REQUIRED (3 files)
│   ├── js/*.js                   ✅ REQUIRED (5 files)
│   ├── data/*.json               ✅ REQUIRED (2 files)
│   └── images/favicon.svg        ✅ REQUIRED
├── pages/*.html                  ✅ REQUIRED (3 files)
└── README.md                     ✅ REQUIRED
```

**DO NOT upload:** `models/`, `.venv311/`, `__pycache__/`, `*.pyc`, `app.py`, `utils/`, `requirements.txt`

### Step-by-Step

#### Option A: Git Command Line
```bash
cd "C:\Users\YOUR_NAME\Downloads\Cardmom-india\Cardmom-india"
git init
git add website/
git commit -m "Add website version with dark green theme and PDF export"
git remote add origin https://github.com/YOUR_USERNAME/Cardmom-india.git
git push -u origin main
```

#### Option B: GitHub Web Interface
1. Go to your GitHub repository
2. Click **Add file → Upload files**
3. Drag the entire `website/` folder
4. Write commit message and click **Commit changes**

### Enable GitHub Pages
1. Go to repo **Settings → Pages** (left sidebar)
2. Under Source: Branch `main`, Folder: `/website`
3. Click **Save** → wait 2-3 minutes
4. Visit: `https://YOUR_USERNAME.github.io/Cardmom-india/website/`

### Troubleshooting
- **404 error** — Check branch name (`main` vs `master`) and folder setting
- **CSS/JS not loading** — All paths must be relative (`assets/css/style.css` not `/assets/css/style.css`)
- **PDF not downloading** — Open browser console (F12) and check for errors

### Deployment Checklist

Before uploading:
- [ ] PDF download button works locally
- [ ] All charts display correctly
- [ ] Dark green theme applied
- [ ] Sample data loads (39 features)
- [ ] Forecast dates are correct (2026)

After uploading:
- [ ] GitHub Pages enabled
- [ ] Website loads at GitHub URL
- [ ] All styles/scripts load (check browser console F12)
- [ ] Charts render correctly
- [ ] PDF downloads successfully
- [ ] Mobile responsive works

---

## 🖥️ Browser Support

| Browser | Version |
|---------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## License

See the root [README.md](../README.md) for license information.
"# Cardamom-Procurement-Intelligence-System" 
