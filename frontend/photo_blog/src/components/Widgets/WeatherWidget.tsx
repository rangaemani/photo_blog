import { useState, useEffect } from 'react';

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
  80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
};

interface WeatherData {
  temp: number;
  code: number;
  wind: number;
  unit: string;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = (lat: number, lon: number) => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`)
      .then(r => r.json())
      .then(d => {
        setWeather({
          temp: Math.round(d.current_weather.temperature),
          code: d.current_weather.weathercode,
          wind: Math.round(d.current_weather.windspeed),
          unit: 'F',
        });
        setLoading(false);
      })
      .catch(() => { setError('Fetch failed'); setLoading(false); });
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation unavailable'); setLoading(false); return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
      () => { setError('Location denied'); setLoading(false); }
    );

    const id = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => fetchWeather(pos.coords.latitude, pos.coords.longitude),
        () => {}
      );
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      width: '100%', height: '100%', padding: 6,
      background: 'var(--platinum)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
    }}>
      {loading && <span style={{ fontSize: 10, color: 'var(--slate-grey)' }}>Loading...</span>}
      {error && (
        <>
          <span style={{ fontSize: 10, color: 'var(--slate-grey)' }}>{error}</span>
          {error === 'Location denied' && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Allow location in browser</span>
          )}
        </>
      )}
      {weather && (
        <div style={{
          borderTop: '1px solid var(--bevel-shadow)',
          borderLeft: '1px solid var(--bevel-shadow)',
          borderBottom: '1px solid var(--bevel-highlight)',
          borderRight: '1px solid var(--bevel-highlight)',
          background: 'var(--inset-bg)',
          padding: '4px 6px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <span style={{ fontSize: 22, fontFamily: "'PixeAn', monospace", color: 'var(--carbon-black)' }}>
            {weather.temp}°{weather.unit}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            {WMO_CODES[weather.code] ?? 'Unknown'}
          </span>
          <span style={{ fontSize: 10, color: 'var(--slate-grey)' }}>
            Wind {weather.wind} km/h
          </span>
        </div>
      )}
    </div>
  );
}
