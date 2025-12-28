let cities = [];
let activeCity = null;

const citiesEl = document.getElementById('cities');
const weatherEl = document.getElementById('weather');
const cityInput = document.getElementById('cityInput');
const cityError = document.getElementById('cityError');
const addCitySection = document.getElementById('add-city');
const suggestionsEl = document.getElementById('suggestions');
const toggleAddCityBtn = document.getElementById('toggleAddCity');

let lastSearchResults = [];


function saveToStorage() {
  localStorage.setItem('cities', JSON.stringify(cities));
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('cities');

    if (saved) {
      cities = JSON.parse(saved);
      activeCity = cities[0];
      renderCities();
      loadWeather(activeCity);
    } else {
      requestGeolocation();
    }
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    requestGeolocation();
  }
}




/* геолокация */

function requestGeolocation() {
  if (!navigator.geolocation) {
    addCitySection.style.display = 'block';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const city = {
        name: 'Current location',
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      };

      cities.push(city);
      activeCity = city;
      saveToStorage();
      renderCities();
      loadWeather(city);
    },
    () => {
      addCitySection.style.display = 'block';
      weatherEl.innerHTML =
        '<p>Please add a city or allow geolocation access</p>';
    }
  );
}




/* города */

function renderCities() {
  citiesEl.innerHTML = '';

  cities.forEach((city, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'city-item';

    const name = document.createElement('span');
    // Показываем name + country если есть
    name.textContent = city.country ? `${city.name}, ${city.country}` : city.name;

    if (city === activeCity) {
      name.style.fontWeight = 'bold';
    }

    name.onclick = () => {
      activeCity = city;
      renderCities();
      loadWeather(city);
    };

    wrapper.appendChild(name);

    if (city.name !== 'Current location') {
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';

      removeBtn.onclick = () => {
        cities.splice(index, 1);
        activeCity = cities[0] || null;
        saveToStorage();
        renderCities();
        if (activeCity) loadWeather(activeCity);
      };

      wrapper.appendChild(removeBtn);
    }

    citiesEl.appendChild(wrapper);
  });
}



/* погода */

/* код погоды (weathercode) в тип погоды*/
function getWeatherDescription(code) {
  if (code === 0) return 'Clear sky ☀️';
  if (code <= 3) return 'Partly cloudy ⛅';
  if (code <= 48) return 'Fog 🌫️';
  if (code <= 57) return 'Drizzle ☔';
  if (code <= 67) return 'Rain 🌦️';
  if (code <= 77) return 'Snow ❄️';
  if (code <= 82) return 'Rain showers 🌧️';
  if (code <= 99) return 'Thunderstorm ⛈️';
  return 'Unknown';
}

function loadWeather(city) {
  weatherEl.innerHTML = '<p class="loader">Loading...</p>';

  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`
  )
    .then(res => {
      if (!res.ok) {
        throw new Error(`Weather API error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (!data.daily || !data.daily.time) {
        throw new Error('Invalid data from weather API');
      }
      renderWeather(data);
    })
    .catch(() => {
      weatherEl.innerHTML = '<p class="error">Error loading weather</p>';
    });
}

function renderWeather(data) {
  let html = `<h2>${activeCity.country ? activeCity.name + ', ' + activeCity.country : activeCity.name}</h2>`;

  for (let i = 0; i < 3; i++) {
    const apiDateStr = data.daily.time[i]; // "2024-12-26"
    const [year, month, day] = apiDateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMonth = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    
    let dayTitle;
    if (i === 0) {
      dayTitle = `Today, ${dayMonth}`;
    } else if (i === 1) {
      dayTitle = `Tomorrow, ${dayMonth}`;
    } else {
      dayTitle = `${dayOfWeek}, ${dayMonth}`; // "Fri, 28 Dec"
    }

    html += `
      <div class="day">
        <div class="day-title">${dayTitle}</div>

        <div class="row">
          <span>Weather</span>
          <span>${getWeatherDescription(data.daily.weathercode[i])}</span>
        </div>

        <div class="row">
          <span>Max temp</span>
          <span>${data.daily.temperature_2m_max[i]} °C</span>
        </div>

        <div class="row">
          <span>Min temp</span>
          <span>${data.daily.temperature_2m_min[i]} °C</span>
        </div>
      </div>
    `;
  }

  weatherEl.innerHTML = html;
}


/* выпадающий список городов */

cityInput.addEventListener('input', () => {
  const value = cityInput.value.trim();
  suggestionsEl.innerHTML = '';
  cityError.textContent = '';

  if (value.length < 2) return;

  fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${value}&count=5`)
    .then(res => {
      if (!res.ok) {
        throw new Error(`Geocoding API error: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (!data.results) {
        return;
      }

      lastSearchResults = data.results;

      data.results.forEach((city, i) => {
        const li = document.createElement('li');
        li.textContent = `${city.name}, ${city.country}`;

        li.onclick = () => {
          cityInput.dataset.index = i;
          cityInput.value = `${city.name}, ${city.country}`;
          suggestionsEl.innerHTML = '';
        };

        suggestionsEl.appendChild(li);
      });
    })
    .catch(() => {
      suggestionsEl.innerHTML = '';
    });
});


/* добавление города */

document.getElementById('addCityBtn').addEventListener('click', () => {
  const index = cityInput.dataset.index;

  if (index === undefined) {
    cityError.textContent = 'Select city from the list';
    return;
  }

  const match = lastSearchResults[index];

  const exists = cities.some(
    c =>
      c.name.toLowerCase() === match.name.toLowerCase() &&
      c.country?.toLowerCase() === match.country?.toLowerCase()
  );

  if (exists) {
    cityError.textContent = 'City already added';
    return;
  }

  const city = {
    name: match.name,
    country: match.country,
    lat: match.latitude,
    lon: match.longitude
  };

  cities.push(city);
  activeCity = city;
  saveToStorage();
  renderCities();
  loadWeather(city);

  cityInput.value = '';
  cityInput.dataset.index = undefined;
  suggestionsEl.innerHTML = '';
  addCitySection.style.display = 'none';
});


toggleAddCityBtn.addEventListener('click', () => {
  addCitySection.style.display =
    addCitySection.style.display === 'none' ? 'block' : 'none';
});


/* обновление */

document.getElementById('refreshBtn').addEventListener('click', () => {
  if (activeCity) loadWeather(activeCity);
});

loadFromStorage();
