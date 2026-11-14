import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, MapPin, LocateFixed, CalendarDays, Wind, Droplets, Sun,
  Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Sunrise, Sunset, Thermometer, ChevronDown, LoaderCircle, RefreshCw,
  History, CloudSun, Compass, X
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'

const weatherInfo = (code = 0) => {
  if (code === 0) return ['Clear sky', Sun]
  if ([1, 2].includes(code)) return ['Mainly clear', CloudSun]
  if (code === 3) return ['Overcast', Cloud]
  if ([45, 48].includes(code)) return ['Fog', CloudFog]
  if ([51, 53, 55, 56, 57].includes(code)) return ['Drizzle', CloudDrizzle]
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['Rain showers', CloudRain]
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['Snow', CloudSnow]
  if ([95, 96, 99].includes(code)) return ['Thunderstorm', CloudLightning]
  return ['Cloudy', Cloud]
}
const round = n => Math.round(Number(n) || 0)
const dateLabel = (value, options = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options)
const todayISO = () => new Date().toISOString().slice(0, 10)
const localISO = d => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}

async function getJSON(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`)
  return response.json()
}
async function searchPlaces(query) {
  const params = new URLSearchParams({ name: query, count: '8', language: 'en', format: 'json' })
  const data = await getJSON(`${GEO}?${params}`)
  return data.results || []
}
const placeName = p => [p.name, p.admin1, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')

function App() {
  const [place, setPlace] = useState({ name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' })
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState('celsius')
  const [mode, setMode] = useState('forecast')
  const [historyDate, setHistoryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return localISO(d)
  })
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [locationLabel, setLocationLabel] = useState('Default location')
  const [geoBusy, setGeoBusy] = useState(false)

  const tempUnit = unit === 'celsius' ? '°' : '°'
  const tempField = unit === 'celsius' ? 'temperature_2m' : 'temperature_2m'
  const displayTemp = value => value == null ? '—' : `${round(unit === 'celsius' ? value : value * 9 / 5 + 32)}${tempUnit}`
  const windUnit = unit === 'celsius' ? 'km/h' : 'mph'
  const displayWind = value => value == null ? '—' : `${round(unit === 'celsius' ? value : value * 0.621371)} ${windUnit}`
  const degreeLabel = unit === 'celsius' ? '°C' : '°F'

  const loadForecast = useCallback(async target => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        latitude: target.latitude, longitude: target.longitude,
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max',
        forecast_days: '7', timezone: 'auto'
      })
      const data = await getJSON(`${FORECAST}?${params}`)
      setWeather(data)
    } catch (e) { setError('Could not load weather right now. Please check your connection and try again.') }
    finally { setLoading(false) }
  }, [])

  const loadHistory = useCallback(async (target, date) => {
    setHistoryLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        latitude: target.latitude, longitude: target.longitude,
        start_date: date, end_date: date,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
        timezone: 'auto'
      })
      const data = await getJSON(`${ARCHIVE}?${params}`)
      setHistoryData(data)
    } catch (e) { setHistoryData(null); setError('Historical data is unavailable for this date or location. Try another date.') }
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { loadForecast(place) }, [place, loadForecast])
  useEffect(() => { if (mode === 'history') loadHistory(place, historyDate) }, [mode, place, historyDate, loadHistory])

  useEffect(() => {
    if (!navigator.geolocation) return
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords
      try {
        const params = new URLSearchParams({ latitude, longitude, count: '1', language: 'en', format: 'json' })
        const reverse = await getJSON(`https://geocoding-api.open-meteo.com/v1/reverse?${params}`)
        const r = reverse.results?.[0]
        setPlace({ name: r?.name || 'Your location', admin1: r?.admin1, country: r?.country || '', latitude, longitude, timezone: r?.timezone })
        setLocationLabel('Your location')
      } catch {
        setPlace(p => ({ ...p, latitude, longitude }))
        setLocationLabel('Your location')
      }
      setGeoBusy(false)
    }, () => setGeoBusy(false), { timeout: 8000, maximumAge: 600000 })
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return }
      setSearching(true)
      try { setResults(await searchPlaces(query.trim())); setShowResults(true) }
      catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const choosePlace = p => {
    setPlace(p); setQuery(''); setResults([]); setShowResults(false); setLocationLabel('Searched location')
  }
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser.'); return }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords
      try {
        const params = new URLSearchParams({ latitude, longitude, count: '1', language: 'en', format: 'json' })
        const data = await getJSON(`https://geocoding-api.open-meteo.com/v1/reverse?${params}`)
        const r = data.results?.[0] || {}
        setPlace({ ...r, name: r.name || 'Your location', latitude, longitude })
      } catch { setPlace(p => ({ ...p, latitude, longitude, name: 'Your location' })) }
      setLocationLabel('Your location'); setGeoBusy(false)
    }, () => { setGeoBusy(false); setError('Location permission was denied. You can search for a city instead.') })
  }

  const current = weather?.current
  const daily = weather?.daily
  const todayCode = current?.weather_code ?? daily?.weather_code?.[0] ?? 0
  const [todayDescription, TodayIcon] = weatherInfo(todayCode)
  const chartData = useMemo(() => {
    if (mode === 'history' && historyData?.daily) {
      const d = historyData.daily
      return [{ label: dateLabel(historyDate, { day: 'numeric', month: 'short' }), high: d.temperature_2m_max?.[0], low: d.temperature_2m_min?.[0], rain: d.precipitation_sum?.[0] }]
    }
    if (!daily) return []
    return daily.time.map((date, i) => ({ label: dateLabel(date, { weekday: 'short' }), high: daily.temperature_2m_max[i], low: daily.temperature_2m_min[i], rain: daily.precipitation_sum[i] }))
  }, [mode, historyData, historyDate, daily])

  const history = historyData?.daily
  const historicalCode = history?.weather_code?.[0] ?? 0
  const [historicalDescription, HistoricalIcon] = weatherInfo(historicalCode)
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() - 5)
  const minDate = '1940-01-01'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><CloudSun size={21}/></span><span>atmos<span className="brand-dot">.</span></span></a>
        <div className="topbar-right">
          <span className="live-dot"></span><span className="live-label">GLOBAL WEATHER</span>
          <button className="unit-toggle" onClick={() => setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}>{unit === 'celsius' ? '°C' : '°F'} <ChevronDown size={14}/></button>
        </div>
      </header>

      <main className="main-content">
        <section className="intro-row">
          <div><div className="eyebrow">WEATHER, WITHOUT BORDERS</div><h1>Know your <span>atmosphere.</span></h1><p className="subtitle">Live conditions, the days ahead, and a window into the past.</p></div>
          <div className="search-wrap">
            <div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length && setShowResults(true)} placeholder="Search any city in the world…" /><button className="locate-btn" title="Use my location" onClick={useMyLocation} disabled={geoBusy}>{geoBusy ? <LoaderCircle className="spin" size={17}/> : <LocateFixed size={17}/>}</button></div>
            {showResults && results.length > 0 && <div className="search-results">{results.map((r, i) => <button key={`${r.id}-${i}`} onClick={() => choosePlace(r)}><MapPin size={15}/><span>{placeName(r)}</span><small>{r.country_code}</small></button>)}</div>}
            {searching && <div className="search-hint">Searching locations…</div>}
          </div>
        </section>

        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}

        <section className="hero-card">
          <div className="hero-glow"></div>
          <div className="hero-topline"><span className="location-pill"><MapPin size={13}/>{place.name}{place.admin1 ? `, ${place.admin1}` : ''}</span><span className="updated-label"><span className="live-dot"></span>{locationLabel}</span></div>
          {loading ? <div className="hero-loading"><LoaderCircle className="spin" size={28}/> Loading current conditions…</div> : (
            <div className="hero-main">
              <div className="hero-temp-block"><div className="hero-condition"><TodayIcon size={25}/><span>{todayDescription}</span></div><div className="hero-temp">{displayTemp(current?.temperature_2m)}<span>{degreeLabel}</span></div><div className="feels-like">Feels like {displayTemp(current?.apparent_temperature)}</div></div>
              <div className="hero-weather-art"><TodayIcon size={116} strokeWidth={1.1}/><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div></div>
              <div className="hero-details">
                <div className="detail-item"><span className="detail-icon"><Wind size={17}/></span><div><small>WIND</small><strong>{displayWind(current?.wind_speed_10m)}</strong></div></div>
                <div className="detail-item"><span className="detail-icon"><Droplets size={17}/></span><div><small>HUMIDITY</small><strong>{current?.relative_humidity_2m ?? '—'}%</strong></div></div>
                <div className="detail-item"><span className="detail-icon"><Droplets size={17}/></span><div><small>PRECIPITATION</small><strong>{current?.precipitation ?? '—'} mm</strong></div></div>
              </div>
            </div>
          )}
          <div className="hero-footer"><span><Compass size={14}/>{place.latitude?.toFixed(2)}°, {place.longitude?.toFixed(2)}°</span><span><RefreshCw size={13}/> Live weather</span></div>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE TIMELINE</div><h2>Weather timeline</h2></div><div className="mode-tabs"><button className={mode === 'forecast' ? 'active' : ''} onClick={() => setMode('forecast')}><Sun size={15}/> Forecast</button><button className={mode === 'history' ? 'active' : ''} onClick={() => setMode('history')}><History size={15}/> History</button></div></div>
          {mode === 'forecast' ? (
            <div className="forecast-grid">{daily?.time?.map((date, i) => { const [desc, Icon] = weatherInfo(daily.weather_code[i]); return <article className={`forecast-day ${i === 0 ? 'today' : ''}`} key={date}><div className="forecast-date">{i === 0 ? 'Today' : dateLabel(date)}</div><Icon className="forecast-icon" size={27}/><div className="forecast-desc">{desc}</div><div className="forecast-temps"><strong>{displayTemp(daily.temperature_2m_max[i])}</strong><span>{displayTemp(daily.temperature_2m_min[i])}</span></div><div className="rain-chance"><Droplets size={12}/>{daily.precipitation_probability_max?.[i] ?? 0}%</div></article> }) || <div className="empty-state">Forecast will appear when weather data loads.</div>}</div>
          ) : (
            <div className="history-panel">
              <div className="history-controls"><div><span className="control-label">CHOOSE A PAST DATE</span><p>Explore recorded daily conditions</p></div><div className="date-control"><CalendarDays size={16}/><input type="date" min={minDate} max={localISO(maxDate)} value={historyDate} onChange={e => setHistoryDate(e.target.value)}/></div></div>
              {historyLoading ? <div className="history-loading"><LoaderCircle className="spin" size={22}/> Retrieving historical weather…</div> : history ? <div className="history-result"><div className="history-weather-icon"><HistoricalIcon size={34}/></div><div className="history-main"><span>{dateLabel(historyDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><strong>{historicalDescription}</strong></div><div className="history-stat"><small>HIGH</small><strong>{displayTemp(history.temperature_2m_max?.[0])}</strong></div><div className="history-stat"><small>LOW</small><strong>{displayTemp(history.temperature_2m_min?.[0])}</strong></div><div className="history-stat"><small>RAIN</small><strong>{history.precipitation_sum?.[0] ?? '—'} mm</strong></div><div className="history-stat"><small>MAX WIND</small><strong>{displayWind(history.wind_speed_10m_max?.[0])}</strong></div></div> : <div className="empty-state">Select a date to load historical observations.</div>}
              <p className="history-note">Historical coverage starts in 1940 for many locations. Availability and completeness depend on the selected region.</p>
            </div>
          )}
        </section>

        <section className="section-block chart-section">
          <div className="section-heading"><div><div className="eyebrow">{mode === 'history' ? 'PAST CONDITIONS' : 'THE WEEK AHEAD'}</div><h2>{mode === 'history' ? 'Historical snapshot' : 'Temperature outlook'}</h2></div><span className="chart-unit">Temperature · {degreeLabel}</span></div>
          <div className="chart-card">
            {mode === 'history' && !history ? <div className="empty-state">Historical chart appears after you select a date.</div> : chartData.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}><defs><linearGradient id="highFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb86b" stopOpacity={0.24}/><stop offset="100%" stopColor="#ffb86b" stopOpacity={0}/></linearGradient><linearGradient id="lowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70b8ff" stopOpacity={0.18}/><stop offset="100%" stopColor="#70b8ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" stroke="#26364c" vertical={false}/><XAxis dataKey="label" tick={{ fill: '#8798ad', fontSize: 12 }} axisLine={false} tickLine={false} dy={10}/><YAxis tick={{ fill: '#8798ad', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${round(unit === 'celsius' ? v : v * 9 / 5 + 32)}°`}/><Tooltip contentStyle={{ background: '#17263a', border: '1px solid #31445d', borderRadius: 12, color: '#fff' }} formatter={(v, name) => [`${displayTemp(v)}`, name === 'high' ? 'High' : 'Low']}/><Area type="monotone" dataKey="high" stroke="#ffb86b" strokeWidth={2.5} fill="url(#highFill)" dot={{ r: 3, fill: '#ffb86b', strokeWidth: 0 }}/><Area type="monotone" dataKey="low" stroke="#70b8ff" strokeWidth={2.5} fill="url(#lowFill)" dot={{ r: 3, fill: '#70b8ff', strokeWidth: 0 }}/></AreaChart></ResponsiveContainer> : <div className="empty-state">Weather data will appear here.</div>}
            <div className="chart-legend"><span><i className="legend-high"></i> Daily high</span><span><i className="legend-low"></i> Daily low</span></div>
          </div>
        </section>

        <footer><div className="footer-brand"><CloudSun size={17}/> atmos<span>.</span></div><p>Weather data provided by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Free weather API</p><p className="footer-small">Forecasts are estimates. Historical data may be revised or incomplete.</p></footer>
      </main>
    </div>
  )
}

export default App
