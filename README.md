# Atmos — Global Weather Dashboard

A responsive weather app built with React + Vite. Uses the free Open-Meteo APIs (no API key required).

## Features
- Detects your location in the browser (with permission); falls back to London.
- Search cities worldwide using Open-Meteo geocoding.
- Current conditions and up to 7 days of forecast.
- Historical daily weather for dates from 1940; the date picker starts five days back to account for reanalysis publication delay.
- Temperature, precipitation and wind charts.
- Celsius/Fahrenheit toggle, responsive layout and loading/error states.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Create a GitHub repository and upload/push the contents of this folder.
2. In Vercel choose **Add New → Project**, import the repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Deploy. No environment variables or API keys are needed.

## APIs
- Geocoding: https://geocoding-api.open-meteo.com/v1/search
- Forecast/current: https://api.open-meteo.com/v1/forecast
- Historical archive: https://archive-api.open-meteo.com/v1/archive

Browser geolocation requires the user's permission and a secure context (HTTPS; Vercel provides HTTPS). If permission is denied or unavailable, London is used as the starting location.

Open-Meteo's free hosted service is intended for non-commercial use under its published terms. Review its terms and attribution requirements before commercial use: https://open-meteo.com/en/terms
