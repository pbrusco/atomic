# ⚡ Atomic

A minimalist Progressive Web App (PWA) habit tracker for daily progressions (e.g., +1 push-up every 2 days). It is designed to start small and gradually scale the daily target until you reach your goal.

Live at: **https://pbrusco.github.io/atomic/**

## 🚀 Features
- **PWA support**: Installs directly onto your home screen (iOS/Android/Desktop) and works offline.
- **Dynamic Progression**: Enter your starting count, target goal, increment rate, and scaling interval.
- **Racha (Streak) & Consistency Tracker**: Visual calendar ledger representing completion history for the last 14 days. Includes progressive emojis (⚡ → 🔥 → 💪 → 🚀 → 👑 → 🏆) based on your program progression.
- **Interactive Updates**: Notifies you with a banner when a new version of the app is available and allows you to refresh instantly.
- **Privacy First**: All data is saved locally on your device (`localStorage`) — no accounts, no tracking.

## 🛠️ Local Development
To run this project locally, make sure you have Node.js installed, then:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the local dev server**:
   ```bash
   npm run dev
   ```

3. **Build the production bundle**:
   ```bash
   npm run build
   ```

4. **Preview the production build**:
   ```bash
   npm run preview
   ```

## 📦 Deployment (GitHub Pages)
This repository is configured to automatically build and deploy via GitHub Actions.

> [!IMPORTANT]
> **One-time Setup:**
> To enable automatic deployments, go to your repository **Settings** > **Pages** on GitHub:
> Under **Build and deployment** > **Source**, change the selection from **Deploy from a branch** to **GitHub Actions**.
>
> The workflow will now automatically inject the short commit hash into the footer and bust the PWA Service Worker cache on every push to `main`!
