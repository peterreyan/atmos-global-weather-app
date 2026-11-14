import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Search, MapPin, LocateFixed, CalendarDays, Wind, Droplets, Sun,
  Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog,
  Sunrise, Sunset, Thermometer, ChevronDown, LoaderCircle, RefreshCw,
  History, CloudSun, Compass, X, Gauge, Eye, GaugeCircle, ArrowUpRight,
  Cloudy, Waves, Activity, Clock3, Umbrella, Leaf, Sparkles
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Bar, BarChart
} from 'recharts'

const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality'

const weatherInfo = (code = 0) => {
  if (code === 0) return ['Clear sky', Sun]
  if ([1, 2].includes(code)) return ['Partly cloudy', CloudSun]
  if (code === 3) return ['Overcast', Cloud]
  if ([45, 48].includes(code)) return ['Foggy', CloudFog]
  if ([51, 53, 55, 56, 57].includes(code)) return ['Light drizzle', CloudDrizzle]
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['Rain showers', CloudRain]
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ['Snowfall', CloudSnow]
  if ([95, 96, 99].includes(code)) return ['Thunderstorm', CloudLightning]
  return ['Cloudy', Cloudy]
}
const round = n => n == null ? '—' : Math.round(Number(n))
const dateLabel = (value, options = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, options)
const localISO = d => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return x.toISOString().slice(0, 10)
}
const placeName = p => [p.name, p.admin1, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ')
const imageForCode = code => {
  if ([61,63,65,80,81,82,95,96,99].includes(code)) return 'https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1800&q=85'
  if ([71,73,75,77,85,86].includes(code)) return 'https://images.unsplash.com/photo-1517299321609-52687d1bc55a?auto=format&fit=crop&w=1800&q=85'
  if ([45,48].includes(code)) return 'https://images.unsplash.com/photo-1485236715568-ddc5ee6ca227?auto=format&fit=crop&w=1800&q=85'
  if (code === 0) return 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85'
  return 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1800&q=85'
}
const aqiInfo = value => {
  if (value == null) return { label: 'Unavailable', tone: 'muted', advice: 'Air quality data is not available for this location.' }
  if (value <= 50) return { label: 'Good', tone: 'good', advice: 'Air quality is considered satisfactory. Enjoy your time outdoors.' }
  if (value <= 100) return { label: 'Moderate', tone: 'moderate', advice: 'Generally acceptable. Sensitive people may wish to limit prolonged outdoor exertion.' }
  if (value <= 150) return { label: 'Unhealthy for sensitive groups', tone: 'sensitive', advice: 'Sensitive groups should reduce prolonged or heavy outdoor activity.' }
  if (value <= 200) return { label: 'Unhealthy', tone: 'unhealthy', advice: 'Everyone may begin to experience effects. Consider reducing outdoor exertion.' }
  if (value <= 300) return { label: 'Very unhealthy', tone: 'very', advice: 'Health alert: reduce outdoor activity and consider staying indoors.' }
  return { label: 'Hazardous', tone: 'hazardous', advice: 'Health emergency conditions. Avoid outdoor activity.' }
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

function App() {
  const [place, setPlace] = useState({ name: 'London', admin1: 'England', country: 'United Kingdom', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' })
  const [weather, setWeather] = useState(null)
  const [air, setAir] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unit, setUnit] = useState('celsius')
  const [mode, setMode] = useState('forecast')
  const [historyDate, setHistoryDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return localISO(d) })
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [geoBusy, setGeoBusy] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  const displayTemp = value => value == null ? '—' : `${round(unit === 'celsius' ? value : value * 9 / 5 + 32)}°`
  const displayWind = value => value == null ? '—' : `${round(unit === 'celsius' ? value : value * 0.621371)} ${unit === 'celsius' ? 'km/h' : 'mph'}`
  const displayVisibility = value => value == null ? '—' : `${(value / 1000).toFixed(1)} km`

  const loadForecast = useCallback(async target => {
    setLoading(true); setError('')
    try {
      const common = { latitude: target.latitude, longitude: target.longitude, timezone: 'auto' }
      const params = new URLSearchParams({
        ...Object.fromEntries(Object.entries(common).map(([k,v]) => [k,String(v)])),
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,visibility,uv_index',
        hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,uv_index_max',
        forecast_days: '7'
      })
      const airParams = new URLSearchParams({
        latitude: String(target.latitude), longitude: String(target.longitude), timezone: 'auto',
        current: 'us_aqi,european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide',
        hourly: 'us_aqi,pm2_5,pm10', forecast_days: '1'
      })
      const [forecastResult, airResult] = await Promise.allSettled([
        getJSON(`${FORECAST}?${params}`), getJSON(`${AIR}?${airParams}`)
      ])
      if (forecastResult.status === 'rejected') throw forecastResult.reason
      setWeather(forecastResult.value)
      setAir(airResult.status === 'fulfilled' ? airResult.value : null)
      setLastUpdated(new Date())
    } catch (e) { setError('Could not load weather right now. Please check your connection and try again.') }
    finally { setLoading(false) }
  }, [])

  const loadHistory = useCallback(async (target, date) => {
    setHistoryLoading(true); setError('')
    try {
      const params = new URLSearchParams({
        latitude: String(target.latitude), longitude: String(target.longitude),
        start_date: date, end_date: date,
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
        timezone: 'auto'
      })
      setHistoryData(await getJSON(`${ARCHIVE}?${params}`))
    } catch { setHistoryData(null); setError('Historical data is unavailable for this date or location. Try another date.') }
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
        const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), count: '1', language: 'en', format: 'json' })
        const reverse = await getJSON(`https://geocoding-api.open-meteo.com/v1/reverse?${params}`)
        const r = reverse.results?.[0]
        setPlace({ name: r?.name || 'Your location', admin1: r?.admin1, country: r?.country || '', latitude, longitude, timezone: r?.timezone })
      } catch { setPlace(p => ({ ...p, latitude, longitude })) }
      setGeoBusy(false)
    }, () => setGeoBusy(false), { timeout: 8000, maximumAge: 600000 })
  }, [])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) { setResults([]); return }
      setSearching(true)
      try { setResults(await searchPlaces(query.trim())); setShowResults(true) } catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const choosePlace = p => { setPlace(p); setQuery(''); setResults([]); setShowResults(false) }
  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Location is not supported by this browser.'); return }
    setGeoBusy(true)
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude, longitude } = pos.coords
      try {
        const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), count: '1', language: 'en', format: 'json' })
        const data = await getJSON(`https://geocoding-api.open-meteo.com/v1/reverse?${params}`)
        const r = data.results?.[0] || {}
        setPlace({ ...r, name: r.name || 'Your location', latitude, longitude })
      } catch { setPlace(p => ({ ...p, latitude, longitude, name: 'Your location' })) }
      setGeoBusy(false)
    }, () => { setGeoBusy(false); setError('Location permission was denied. Search for a city instead.') })
  }

  const current = weather?.current
  const daily = weather?.daily
  const code = current?.weather_code ?? 0
  const [description, WeatherIcon] = weatherInfo(code)
  const bgImage = imageForCode(code)
  const aqi = aqiInfo(air?.current?.us_aqi)
  const hourly = useMemo(() => {
    if (!weather?.hourly || !current?.time) return []
    const h = weather.hourly
    const idx = Math.max(0, h.time.findIndex(t => t.slice(0,13) === current.time.slice(0,13)))
    return h.time.slice(idx, idx + 12).map((time, i) => ({
      time: new Date(time).toLocaleTimeString([], { hour: 'numeric' }),
      temp: h.temperature_2m[idx + i], rain: h.precipitation_probability?.[idx + i] ?? 0,
      code: h.weather_code[idx + i]
    }))
  }, [weather, current])
  const chartData = useMemo(() => {
    if (mode === 'history' && historyData?.daily) {
      const d = historyData.daily
      return [{ label: dateLabel(historyDate, { day: 'numeric', month: 'short' }), high: d.temperature_2m_max?.[0], low: d.temperature_2m_min?.[0] }]
    }
    if (!daily) return []
    return daily.time.map((date, i) => ({ label: dateLabel(date, { weekday: 'short' }), high: daily.temperature_2m_max[i], low: daily.temperature_2m_min[i] }))
  }, [mode, historyData, historyDate, daily])
  const airCurrent = air?.current
  const airHourly = air?.hourly
  const airTrend = airHourly?.us_aqi?.slice(0, 12).map((v, i) => ({ time: new Date(airHourly.time[i]).toLocaleTimeString([], { hour: 'numeric' }), aqi: v })) || []
  const historical = historyData?.daily
  const [historyDescription, HistoryIcon] = weatherInfo(historical?.weather_code?.[0] ?? 0)
  const maxDate = new Date(); maxDate.setDate(maxDate.getDate() - 5)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span className="brand-mark"><CloudSun size={21}/></span><span>atmos<span className="brand-dot">.</span></span></a>
        <div className="topbar-right"><span className="live-dot"></span><span className="live-label">YOUR WORLD, IN WEATHER</span><button className="unit-toggle" onClick={() => setUnit(unit === 'celsius' ? 'fahrenheit' : 'celsius')}>{unit === 'celsius' ? '°C' : '°F'} <ChevronDown size={14}/></button></div>
      </header>

      <main className="main-content">
        <section className="intro-row">
          <div><div className="eyebrow">THE WORLD, AT A GLANCE</div><h1>Feel the forecast.</h1><p className="subtitle">A clearer view of the weather, the air, and what’s coming next.</p></div>
          <div className="search-wrap">
            <div className="search-box"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => results.length && setShowResults(true)} placeholder="Find a city anywhere…" /><button className="locate-btn" title="Use my location" onClick={useMyLocation} disabled={geoBusy}>{geoBusy ? <LoaderCircle className="spin" size={17}/> : <LocateFixed size={17}/>}</button></div>
            {showResults && results.length > 0 && <div className="search-results">{results.map((r, i) => <button key={`${r.id}-${i}`} onClick={() => choosePlace(r)}><MapPin size={15}/><span>{placeName(r)}</span><small>{r.country_code}</small></button>)}</div>}
            {searching && <div className="search-hint">Finding places…</div>}
          </div>
        </section>

        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}

        <section className="hero-card" style={{'--hero-image': `url("${bgImage}")`}}>
          <div className="hero-shade"></div>
          <div className="hero-topline"><span className="location-pill"><MapPin size={13}/>{place.name}{place.admin1 ? `, ${place.admin1}` : ''}</span><span className="updated-label"><span className="live-dot"></span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}` : 'Live conditions'}</span></div>
          {loading ? <div className="hero-loading"><LoaderCircle className="spin" size={28}/> Reading the skies…</div> : (
            <div className="hero-main">
              <div className="hero-temp-block"><div className="hero-condition"><WeatherIcon size={25}/><span>{description}</span></div><div className="hero-temp">{displayTemp(current?.temperature_2m)}</div><div className="feels-like">Feels like {displayTemp(current?.apparent_temperature)} <span>·</span> {place.country || 'Around you'}</div></div>
              <div className="hero-weather-art"><WeatherIcon size={116} strokeWidth={1.1}/><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div></div>
              <div className="hero-details">
                <div className="detail-item"><span className="detail-icon"><Wind size={17}/></span><div><small>WIND</small><strong>{displayWind(current?.wind_speed_10m)}</strong></div></div>
                <div className="detail-item"><span className="detail-icon"><Droplets size={17}/></span><div><small>HUMIDITY</small><strong>{current?.relative_humidity_2m ?? '—'}%</strong></div></div>
                <div className="detail-item"><span className="detail-icon"><Eye size={17}/></span><div><small>VISIBILITY</small><strong>{displayVisibility(current?.visibility)}</strong></div></div>
              </div>
            </div>
          )}
          <div className="hero-footer"><span><Compass size={14}/>{place.latitude?.toFixed(2)}°, {place.longitude?.toFixed(2)}°</span><span><RefreshCw size={13}/> Powered by live data</span></div>
        </section>

        <section className="quick-stats">
          <article className="stat-card"><span className="stat-icon amber"><Thermometer size={18}/></span><div><small>FEELS LIKE</small><strong>{displayTemp(current?.apparent_temperature)}</strong><em>Perceived temperature</em></div></article>
          <article className="stat-card"><span className="stat-icon blue"><Gauge size={18}/></span><div><small>PRESSURE</small><strong>{round(current?.pressure_msl)} <i>hPa</i></strong><em>Sea-level pressure</em></div></article>
          <article className="stat-card"><span className="stat-icon violet"><Cloud size={18}/></span><div><small>CLOUD COVER</small><strong>{round(current?.cloud_cover)}<i>%</i></strong><em>Sky coverage</em></div></article>
          <article className="stat-card"><span className="stat-icon green"><Sun size={18}/></span><div><small>UV INDEX</small><strong>{current?.uv_index == null ? '—' : Number(current.uv_index).toFixed(1)}</strong><em>Current UV level</em></div></article>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">HOUR BY HOUR</div><h2>The next 12 hours</h2></div><span className="section-meta">Temperature & chance of rain</span></div>
          <div className="hourly-strip">{hourly.length ? hourly.map((h, i) => { const [d, Icon] = weatherInfo(h.code); return <article className={`hour-card ${i === 0 ? 'now' : ''}`} key={`${h.time}-${i}`}><span>{i === 0 ? 'Now' : h.time}</span><Icon size={22}/><strong>{displayTemp(h.temp)}</strong><small><Droplets size={11}/>{h.rain}%</small></article> }) : <div className="empty-state">Hourly forecast will appear when data loads.</div>}</div>
        </section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">BREATHE A LITTLE EASIER</div><h2>Air quality</h2></div><span className="section-meta">Live air pollution indicators</span></div>
          <div className="air-grid">
            <article className={`aqi-card ${aqi.tone}`}>
              <div className="aqi-top"><span className="aqi-label"><Activity size={15}/> US AIR QUALITY INDEX</span><span className="aqi-live"><i></i> LIVE</span></div>
              <div className="aqi-score-row"><strong>{round(airCurrent?.us_aqi)}</strong><div><span className="aqi-status">{aqi.label}</span><p>{aqi.advice}</p></div></div>
              <div className="aqi-scale"><div className="scale-gradient"></div><div className="scale-labels"><span>Good</span><span>Moderate</span><span>Poor</span><span>Hazardous</span></div></div>
              <div className="aqi-secondary"><span>European AQI <b>{round(airCurrent?.european_aqi)}</b></span><span>Updated with local forecast</span></div>
            </article>
            <article className="pollutants-card">
              <div className="pollutants-heading"><div><small>WHAT'S IN THE AIR</small><h3>Pollutant levels</h3></div><Leaf size={20}/></div>
              <div className="pollutant-list">
                <div><span><i className="dot pm"></i>PM2.5</span><b>{airCurrent?.pm2_5 == null ? '—' : `${Number(airCurrent.pm2_5).toFixed(1)} µg/m³`}</b></div>
                <div><span><i className="dot pm"></i>PM10</span><b>{airCurrent?.pm10 == null ? '—' : `${Number(airCurrent.pm10).toFixed(1)} µg/m³`}</b></div>
                <div><span><i className="dot ozone"></i>Ozone (O₃)</span><b>{airCurrent?.ozone == null ? '—' : `${Number(airCurrent.ozone).toFixed(1)} µg/m³`}</b></div>
                <div><span><i className="dot no2"></i>Nitrogen dioxide</span><b>{airCurrent?.nitrogen_dioxide == null ? '—' : `${Number(airCurrent.nitrogen_dioxide).toFixed(1)} µg/m³`}</b></div>
              </div>
              <p className="pollutant-foot">Concentrations are modelled estimates, not measurements from a local monitoring station.</p>
            </article>
          </div>
          {airTrend.length > 1 && <div className="air-trend"><div className="trend-heading"><span>Air quality trend · next hours</span><small>US AQI</small></div><ResponsiveContainer width="100%" height={115}><AreaChart data={airTrend} margin={{top:8,right:10,left:-18,bottom:0}}><defs><linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8dd9b2" stopOpacity={.25}/><stop offset="100%" stopColor="#8dd9b2" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" stroke="#26364c" vertical={false}/><XAxis dataKey="time" tick={{fill:'#8798ad',fontSize:10}} axisLine={false} tickLine={false}/><YAxis tick={{fill:'#8798ad',fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:'#17263a',border:'1px solid #31445d',borderRadius:10,color:'#fff'}}/><Area dataKey="aqi" name="US AQI" type="monotone" stroke="#8dd9b2" fill="url(#aqiFill)" strokeWidth={2} /></AreaChart></ResponsiveContainer></div>}
        </section>

        <section className="section-block">
          <div className="section-heading"><div><div className="eyebrow">EXPLORE THE TIMELINE</div><h2>Weather outlook</h2></div><div className="mode-tabs"><button className={mode === 'forecast' ? 'active' : ''} onClick={() => setMode('forecast')}><Sun size={15}/> 7-day forecast</button><button className={mode === 'history' ? 'active' : ''} onClick={() => setMode('history')}><History size={15}/> History</button></div></div>
          {mode === 'forecast' ? <div className="forecast-grid">{daily?.time?.map((date, i) => { const [desc, Icon] = weatherInfo(daily.weather_code[i]); return <article className={`forecast-day ${i === 0 ? 'today' : ''}`} key={date}><div className="forecast-date">{i === 0 ? 'Today' : dateLabel(date)}</div><Icon className="forecast-icon" size={28}/><div className="forecast-desc">{desc}</div><div className="forecast-temps"><strong>{displayTemp(daily.temperature_2m_max[i])}</strong><span>{displayTemp(daily.temperature_2m_min[i])}</span></div><div className="rain-chance"><Droplets size={12}/>{daily.precipitation_probability_max?.[i] ?? 0}% rain</div><div className="forecast-extra"><span><Wind size={11}/>{displayWind(daily.wind_speed_10m_max?.[i])}</span><span><Sun size={11}/> UV {daily.uv_index_max?.[i] ?? '—'}</span></div></article> }) || <div className="empty-state">Forecast will appear when weather data loads.</div>}</div> : (
            <div className="history-panel"><div className="history-controls"><div><span className="control-label">CHOOSE A PAST DATE</span><p>Explore historical daily conditions</p></div><div className="date-control"><CalendarDays size={16}/><input type="date" min="1940-01-01" max={localISO(maxDate)} value={historyDate} onChange={e => setHistoryDate(e.target.value)}/></div></div>
              {historyLoading ? <div className="history-loading"><LoaderCircle className="spin" size={22}/> Retrieving historical weather…</div> : historical ? <div className="history-result"><div className="history-weather-icon"><HistoryIcon size={34}/></div><div className="history-main"><span>{dateLabel(historyDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span><strong>{historyDescription}</strong></div><div className="history-stat"><small>HIGH</small><strong>{displayTemp(historical.temperature_2m_max?.[0])}</strong></div><div className="history-stat"><small>LOW</small><strong>{displayTemp(historical.temperature_2m_min?.[0])}</strong></div><div className="history-stat"><small>RAIN</small><strong>{historical.precipitation_sum?.[0] ?? '—'} mm</strong></div><div className="history-stat"><small>MAX WIND</small><strong>{displayWind(historical.wind_speed_10m_max?.[0])}</strong></div></div> : <div className="empty-state">Select a date to load historical observations.</div>}
              <p className="history-note">Historical coverage starts in 1940 for many locations. Recent data has a reanalysis publication delay.</p>
            </div>
          )}
        </section>

        <section className="section-block chart-section">
          <div className="section-heading"><div><div className="eyebrow">{mode === 'history' ? 'PAST CONDITIONS' : 'THE WEEK AHEAD'}</div><h2>{mode === 'history' ? 'Historical temperature' : 'Temperature curve'}</h2></div><span className="section-meta">Daily high & low · {unit === 'celsius' ? '°C' : '°F'}</span></div>
          <div className="chart-card">{mode === 'history' && !historical ? <div className="empty-state">Historical chart appears after you select a date.</div> : chartData.length ? <ResponsiveContainer width="100%" height={220}><AreaChart data={chartData} margin={{top:12,right:12,left:-18,bottom:0}}><defs><linearGradient id="highFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb86b" stopOpacity={.24}/><stop offset="100%" stopColor="#ffb86b" stopOpacity={0}/></linearGradient><linearGradient id="lowFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#70b8ff" stopOpacity={.18}/><stop offset="100%" stopColor="#70b8ff" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 5" stroke="#26364c" vertical={false}/><XAxis dataKey="label" tick={{fill:'#8798ad',fontSize:12}} axisLine={false} tickLine={false} dy={10}/><YAxis tick={{fill:'#8798ad',fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v => `${round(unit === 'celsius' ? v : v * 9 / 5 + 32)}°`}/><Tooltip contentStyle={{background:'#17263a',border:'1px solid #31445d',borderRadius:12,color:'#fff'}} formatter={v => [`${displayTemp(v)}`]}/><Area type="monotone" dataKey="high" name="Daily high" stroke="#ffb86b" strokeWidth={2.5} fill="url(#highFill)" dot={{r:3,fill:'#ffb86b',strokeWidth:0}}/><Area type="monotone" dataKey="low" name="Daily low" stroke="#70b8ff" strokeWidth={2.5} fill="url(#lowFill)" dot={{r:3,fill:'#70b8ff',strokeWidth:0}}/></AreaChart></ResponsiveContainer> : <div className="empty-state">Weather data will appear here.</div>}<div className="chart-legend"><span><i className="legend-high"></i> Daily high</span><span><i className="legend-low"></i> Daily low</span></div></div>
        </section>

        <footer><div className="footer-brand"><CloudSun size={17}/> atmos<span>.</span></div><p>Weather & air quality by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Free API</p><p className="footer-small">Air quality index is an estimate; not a substitute for official local alerts.</p></footer>
      </main>
    </div>
  )
}
export default App
