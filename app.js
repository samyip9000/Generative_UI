// Weather codes per Open-Meteo (WMO):
// https://open-meteo.com/en/docs
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

const GREETINGS = {
  sunny:  ["What a beautiful day!", "The sun is yours to enjoy.", "Sunshine looks good on you.", "A bright day calls for big plans."],
  cloudy: ["A soft, quiet kind of day.", "Take it easy under those clouds.", "Mellow skies, mellow mood.", "Perfect weather for a long walk."],
  rainy:  ["Stay cozy out there.", "Rain has its own kind of magic.", "A good day for tea and a book.", "Don't forget your umbrella."],
  snowy:  ["A snowy hush over everything.", "Bundle up — the world is white today.", "Snow days are for slowing down.", "Watch the snow fall and breathe."],
  stormy: ["Big sky energy today.", "Stay safe — the sky is loud.", "A dramatic day for indoor plans.", "Let the storm pass with a warm drink."],
  foggy:  ["A mysterious morning awaits.", "The world looks softer through fog.", "Drive gently — the sky's a secret today.", "A dreamy, hushed kind of day."],
  night:  ["The night is quiet and yours.", "Rest well under the stars.", "A calm night in the city.", "Let the day go — it's been enough."],
};

function timeOfDay(hour) {
  if (hour < 5)  return { label: "Late night",  greet: "Good night" };
  if (hour < 12) return { label: "Morning",     greet: "Good morning" };
  if (hour < 17) return { label: "Afternoon",   greet: "Good afternoon" };
  if (hour < 21) return { label: "Evening",     greet: "Good evening" };
  return                { label: "Night",       greet: "Good night" };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setError(msg) {
  const el = document.getElementById("error");
  el.textContent = msg;
  el.hidden = false;
}

async function getCoords() {
  // Try browser geolocation first; fall back to IP-based lookup.
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(ipLookup());
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" }),
      () => resolve(ipLookup()),
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
    // Final fallback: London.
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
    temp:  Math.round(d.current.temperature_2m),
    code:  d.current.weather_code,
    isDay: d.current.is_day === 1,
  };
}

function render({ weather, locationLabel }) {
  const tod = timeOfDay(new Date().getHours());
  const info = WEATHER_CODES[weather.code] || { theme: "cloudy", icon: "🌡️", desc: "weather unknown" };

  // Night overrides clear/partly-clear themes only — keep storm/snow/rain themes during night for safety cues.
  const useNight = !weather.isDay && ["sunny", "cloudy", "foggy"].includes(info.theme);
  const theme = useNight ? "night" : info.theme;

  document.body.dataset.weather = theme;
  document.getElementById("time-of-day").textContent = tod.label;
  document.getElementById("greeting").textContent = `${tod.greet}. ${pick(GREETINGS[theme])}`;
  document.getElementById("subtitle").textContent =
    `It's ${weather.temp}° and ${info.desc} where you are.`;

  document.getElementById("weather-icon").textContent = useNight ? "🌙" : info.icon;
  document.getElementById("temp").textContent = `${weather.temp}°C`;
  document.getElementById("desc").textContent = info.desc;
  document.getElementById("location").textContent = locationLabel || "Your location";
  document.getElementById("weather").hidden = false;
}

async function main() {
  try {
    const coords = await getCoords();
    const [weather, geoLabel] = await Promise.all([
      getWeather(coords.lat, coords.lon),
      coords.source === "gps" ? reverseGeocode(coords.lat, coords.lon) : Promise.resolve(null),
    ]);
    const locationLabel = geoLabel || [coords.city, coords.region].filter(Boolean).join(", ");
    render({ weather, locationLabel });
  } catch (err) {
    console.error(err);
    setError("Couldn't load today's weather. Showing a default greeting.");
    const tod = timeOfDay(new Date().getHours());
    document.body.dataset.weather = "cloudy";
    document.getElementById("time-of-day").textContent = tod.label;
    document.getElementById("greeting").textContent = `${tod.greet}.`;
    document.getElementById("subtitle").textContent = "Hope you have a lovely day.";
  }
}

main();
