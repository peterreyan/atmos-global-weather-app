# Atmos — Global Weather & Air Quality

A responsive global weather dashboard built with React + Vite. It uses Open-Meteo's free APIs and does not require an API key.

## Features
- Browser location detection (with permission), falling back to London.
- Worldwide city search.
- Live conditions, feels-like temperature, humidity, wind, visibility, pressure, cloud cover and UV.
- 12-hour forecast and 7-day outlook.
- Historical daily weather (coverage and availability vary by location; reanalysis data has a publication delay).
- Current US AQI and European AQI, PM2.5, PM10, ozone and nitrogen dioxide, plus an AQI trend.
- Weather-scene photography that changes with current weather conditions.
- Celsius/Fahrenheit toggle and responsive mobile layout.

## Run locally
```bash
npm install
npm run dev
```

## Deploy to Vercel
1. Upload or push the contents of this folder to a GitHub repository.
2. In Vercel select **Add New → Project** and import the repository.
3. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
4. Deploy. No environment variables or API keys are required.

## APIs
- Geocoding: https://geocoding-api.open-meteo.com/v1/search
- Forecast: https://api.open-meteo.com/v1/forecast
- Historical archive: https://archive-api.open-meteo.com/v1/archive
- Air quality: https://air-quality-api.open-meteo.com/v1/air-quality

Air quality values are modelled estimates and may not match a nearby monitoring station. AQI is shown using the US AQI scale. Review Open-Meteo's terms and attribution requirements before commercial use: https://open-meteo.com/en/terms

Weather scene images are loaded dynamically from Unsplash and require an internet connection.
