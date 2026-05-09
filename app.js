// WMO weather codes per Open-Meteo: https://open-meteo.com/en/docs
const WEATHER_CODES = {
  0:  { theme: "sunny",  icon: "☀️", desc: "clear sky" },
  1:  { theme: "sunny",  icon: "🌤️", desc: "mainly clear" },
  2:  { theme: "cloudy", icon: "⛅", desc: "partly cloudy" },
  3:  { theme: "cloudy", icon: "☁️", desc: "overcast" },
  45: { theme: "foggy",  icon: "🌫️", desc: "foggy" },
  48: { theme: "foggy",  icon: "🌫️", desc: "depositing rime fog" },
  51: { theme: "rainy",  icon: "🌦️", desc: "light drizzle" },
  53: { theme: "rainy",  icon: "🌦️", desc: "moderate drizzle" },
  55: { theme: "rainy",  icon: "🌧️", desc: "dense drizzle" },
  56: { theme: "rainy",  icon: "🌧️", desc: "freezing drizzle" },
  57: { theme: "rainy",  icon: "🌧️", desc: "freezing drizzle" },
  61: { theme: "rainy",  icon: "🌦️", desc: "light rain" },
  63: { theme: "rainy",  icon: "🌧️", desc: "moderate rain" },
  65: { theme: "rainy",  icon: "🌧️", desc: "heavy rain" },
  66: { theme: "rainy",  icon: "🌧️", desc: "freezing rain" },
  67: { theme: "rainy",  icon: "🌧️", desc: "freezing rain" },
  71: { theme: "snowy",  icon: "🌨️", desc: "light snow" },
  73: { theme: "snowy",  icon: "❄️", desc: "moderate snow" },
  75: { theme: "snowy",  icon: "❄️", desc: "heavy snow" },
  77: { theme: "snowy",  icon: "❄️", desc: "snow grains" },
  80: { theme: "rainy",  icon: "🌦️", desc: "rain showers" },
  81: { theme: "rainy",  icon: "🌧️", desc: "heavy rain showers" },
  82: { theme: "rainy",  icon: "⛈️", desc: "violent rain showers" },
  85: { theme: "snowy",  icon: "🌨️", desc: "snow showers" },
  86: { theme: "snowy",  icon: "❄️", desc: "heavy snow showers" },
  95: { theme: "stormy", icon: "⛈️", desc: "thunderstorm" },
  96: { theme: "stormy", icon: "⛈️", desc: "thunderstorm with hail" },
  99: { theme: "stormy", icon: "⛈️", desc: "severe thunderstorm" },
};

function timeOfDay(hour) {
  if (hour < 5)  return { label: "Late night", greet: "Good night" };
  if (hour < 12) return { label: "Morning",    greet: "Good morning" };
  if (hour < 17) return { label: "Afternoon",  greet: "Good afternoon" };
  if (hour < 21) return { label: "Evening",    greet: "Good evening" };
  return                { label: "Night",      greet: "Good night" };
}

function showError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.hidden = false;
}

async function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(ipLookup());
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" }),
      ()    => resolve(ipLookup()),
      { timeout: 5000 }
    );
  });
}

async function ipLookup() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) throw new Error("ip lookup failed");
    const d = await res.json();
    return { lat: d.latitude, lon: d.longitude, city: d.city, region: d.region, source: "ip" };
  } catch {
    return { lat: 51.5074, lon: -0.1278, city: "London", region: "UK", source: "fallback" };
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.results || !d.results.length) return null;
    const r = d.results[0];
    return [r.name, r.admin1, r.country].filter(Boolean).join(", ");
  } catch {
    return null;
  }
}

async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather request failed");
  const d = await res.json();
  return {
    temp:    Math.round(d.current.temperature_2m),
    code:    d.current.weather_code,
    isDay:   d.current.is_day === 1,
    tzTime:  d.current.time,
  };
}

function renderFallback({ weather, locationLabel }) {
  const tod  = timeOfDay(new Date().getHours());
  const info = WEATHER_CODES[weather.code] || { theme: "cloudy", icon: "🌡️", desc: "weather unknown" };
  const useNight = !weather.isDay && ["sunny", "cloudy", "foggy"].includes(info.theme);
  const theme = useNight ? "night" : info.theme;

  document.body.dataset.weather = theme;
  document.getElementById("time-of-day").textContent = tod.label;
  document.getElementById("greeting").textContent    = `${tod.greet}.`;
  document.getElementById("subtitle").textContent    = `It's ${weather.temp}° and ${info.desc} where you are.`;
  document.getElementById("weather-icon").textContent = useNight ? "🌙" : info.icon;
  document.getElementById("temp").textContent        = `${weather.temp}°C`;
  document.getElementById("desc").textContent        = info.desc;
  document.getElementById("location").textContent    = locationLabel || "Your location";
  document.getElementById("weather").hidden          = false;
}

async function generateAIUI(ctx) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ctx),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `generate failed: ${res.status}`);
  }
  return res.json(); // { html, model }
}

function showAIFrame(html, modelName) {
  const frame    = document.getElementById("ai-frame");
  const fallback = document.getElementById("fallback-card");
  const scene    = document.querySelector(".scene");
  const regen    = document.getElementById("regenerate");
  const badge    = document.getElementById("model-badge");

  frame.srcdoc = html;
  frame.hidden = false;
  fallback.style.display = "none";
  scene.style.display    = "none";
  regen.hidden = false;

  if (modelName) {
    badge.textContent = modelName;
    badge.hidden = false;
  }
}

async function run() {
  let coords, weather, locationLabel;
  try {
    coords = await getCoords();
    [weather, locationLabel] = await Promise.all([
      getWeather(coords.lat, coords.lon),
      coords.source === "gps" ? reverseGeocode(coords.lat, coords.lon) : Promise.resolve(null),
    ]);
    locationLabel = locationLabel || [coords.city, coords.region].filter(Boolean).join(", ");
  } catch (err) {
    console.error("weather fetch failed:", err);
    showError("Couldn't determine your weather. Showing a default greeting.");
    document.body.dataset.weather = "cloudy";
    return;
  }

  // Render the static fallback first so the user sees something immediately.
  renderFallback({ weather, locationLabel });

  // Then ask the AI to generate a bespoke UI for these conditions.
  const tod  = timeOfDay(new Date().getHours());
  const info = WEATHER_CODES[weather.code] || { desc: "weather unknown" };
  const ctx  = {
    tempC:       weather.temp,
    description: info.desc,
    weatherCode: weather.code,
    isDay:       weather.isDay,
    timeOfDay:   tod.label.toLowerCase(),
    localTime:   weather.tzTime || new Date().toISOString(),
    location:    locationLabel || "your location",
  };

  try {
    const { html, model } = await generateAIUI(ctx);
    showAIFrame(html, model);
  } catch (err) {
    console.error("AI generation failed:", err);
    showError(`AI generation failed (${err.message}). Showing the static greeting.`);
  }
}

document.getElementById("regenerate").addEventListener("click", () => {
  const btn = document.getElementById("regenerate");
  btn.disabled = true;
  btn.textContent = "↻ Generating…";
  run().finally(() => {
    btn.disabled = false;
    btn.textContent = "↻ Regenerate";
  });
});

run();
