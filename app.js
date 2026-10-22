const whatsappNumber = "254733443226";
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const contactForm = document.querySelector("#contact-form");
const bookingForm = document.querySelector("#booking-form");
const originSelect = document.querySelector("#origin");
const destinationSelect = document.querySelector("#destination");
const dateInput = document.querySelector("#travel-date");
const timeSelect = document.querySelector("#departure-time");
const vehicleSelect = document.querySelector("#vehicle");
const passengerSelect = document.querySelector("#passengers");
const fareEstimate = document.querySelector("#fare-estimate");

const locations = [
  ["Nairobi", "Nairobi", -1.286, 36.817],
  ["Mombasa", "Mombasa", -4.043, 39.668],
  ["Kwale", "Kwale", -4.174, 39.452],
  ["Kilifi", "Kilifi", -3.63, 39.85],
  ["Hola", "Tana River", -1.49, 39.89],
  ["Mokowe", "Lamu", -2.27, 40.90],
  ["Voi", "Taita-Taveta", -3.40, 38.56],
  ["Garissa", "Garissa", -0.46, 39.66],
  ["Wajir", "Wajir", 1.75, 40.06],
  ["Mandera", "Mandera", 3.94, 41.86],
  ["Marsabit", "Marsabit", 2.33, 37.99],
  ["Isiolo", "Isiolo", 0.35, 37.58],
  ["Meru", "Meru", 0.05, 37.65],
  ["Chuka", "Tharaka-Nithi", -0.33, 37.65],
  ["Embu", "Embu", -0.54, 37.45],
  ["Kitui", "Kitui", -1.37, 38.01],
  ["Machakos", "Machakos", -1.52, 37.26],
  ["Wote", "Makueni", -1.78, 37.63],
  ["Ol Kalou", "Nyandarua", -0.27, 36.38],
  ["Nyeri", "Nyeri", -0.42, 36.95],
  ["Kerugoya", "Kirinyaga", -0.50, 37.28],
  ["Murang'a", "Murang'a", -0.72, 37.15],
  ["Kiambu", "Kiambu", -1.17, 36.83],
  ["Lodwar", "Turkana", 3.12, 35.60],
  ["Kapenguria", "West Pokot", 1.24, 35.11],
  ["Maralal", "Samburu", 1.10, 36.70],
  ["Kitale", "Trans Nzoia", 1.02, 35.00],
  ["Eldoret", "Uasin Gishu", 0.51, 35.27],
  ["Iten", "Elgeyo-Marakwet", 0.67, 35.51],
  ["Kapsabet", "Nandi", 0.20, 35.10],
  ["Kabarnet", "Baringo", 0.49, 35.74],
  ["Nanyuki", "Laikipia", 0.02, 37.07],
  ["Nakuru", "Nakuru", -0.30, 36.07],
  ["Narok", "Narok", -1.08, 35.87],
  ["Kajiado", "Kajiado", -1.85, 36.78],
  ["Kericho", "Kericho", -0.37, 35.28],
  ["Bomet", "Bomet", -0.78, 35.34],
  ["Kakamega", "Kakamega", 0.28, 34.75],
  ["Mbale", "Vihiga", 0.08, 34.72],
  ["Bungoma", "Bungoma", 0.57, 34.56],
  ["Busia", "Busia", 0.46, 34.11],
  ["Siaya", "Siaya", 0.06, 34.29],
  ["Kisumu", "Kisumu", -0.10, 34.75],
  ["Homa Bay", "Homa Bay", -0.53, 34.46],
  ["Migori", "Migori", -1.06, 34.47],
  ["Kisii", "Kisii", -0.68, 34.77],
  ["Nyamira", "Nyamira", -0.56, 34.93],
];

const vehicleCapacities = {
  "Shuttle (7 seats)": 7,
  "Minibus (14 seats)": 14,
  "Coach (45 seats)": 45,
};

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

function addLocationOptions(select) {
  const fragment = document.createDocumentFragment();
  locations.forEach(([town, county]) => {
    const option = document.createElement("option");
    option.value = town;
    option.textContent = `${town} · ${county} County`;
    fragment.append(option);
  });
  select.append(fragment);
}

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function refreshDepartureTimes() {
  const currentDate = new Date();
  const selectedDate = dateInput.value;
  const firstHour = selectedDate === localDateValue(currentDate)
    ? currentDate.getHours() + 1
    : 0;
  const fragment = document.createDocumentFragment();

  timeSelect.replaceChildren();
  for (let hour = firstHour; hour < 24; hour += 1) {
    const option = document.createElement("option");
    option.value = `${String(hour).padStart(2, "0")}:00`;
    option.textContent = `${String(hour).padStart(2, "0")}:00`;
    fragment.append(option);
  }

  if (!fragment.childNodes.length) {
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.value = localDateValue(tomorrow);
    refreshDepartureTimes();
    return;
  }

  timeSelect.append(fragment);
}

function updatePassengerOptions() {
  const capacity = vehicleCapacities[vehicleSelect.value];
  const currentPassengers = Number(passengerSelect.value) || 1;
  passengerSelect.replaceChildren();

  for (let count = 1; count <= capacity; count += 1) {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count} ${count === 1 ? "passenger" : "passengers"}`;
    passengerSelect.append(option);
  }

  passengerSelect.value = String(Math.min(currentPassengers, capacity));
}

function findLocation(town) {
  return locations.find(([name]) => name === town);
}

function estimateFarePerPassenger(origin, destination) {
  const start = findLocation(origin);
  const end = findLocation(destination);
  if (!start || !end || origin === destination) return null;

  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(end[2] - start[2]);
  const longitudeDifference = radians(end[3] - start[3]);
  const latitudeStart = radians(start[2]);
  const latitudeEnd = radians(end[2]);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(latitudeStart) * Math.cos(latitudeEnd)
    * Math.sin(longitudeDifference / 2) ** 2;
  const straightLineKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  const estimatedRoadKm = straightLineKm * 1.4;
  return Math.max(500, Math.round((250 + estimatedRoadKm * 4.5) / 100) * 100);
}

function updateFareEstimate() {
  const fare = estimateFarePerPassenger(originSelect.value, destinationSelect.value);
  if (originSelect.value && originSelect.value === destinationSelect.value) {
    fareEstimate.textContent = "Choose a different destination";
    return;
  }
  fareEstimate.textContent = fare === null ? "Choose a route" : `${currency.format(fare)} per passenger`;
}

addLocationOptions(originSelect);
addLocationOptions(destinationSelect);
dateInput.min = localDateValue(new Date());
dateInput.value = dateInput.min;
refreshDepartureTimes();
updatePassengerOptions();
updateFareEstimate();

menuToggle.addEventListener("click", () => {
  const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isExpanded));
  menuToggle.setAttribute("aria-label", isExpanded ? "Open menu" : "Close menu");
  siteNav.classList.toggle("is-open", !isExpanded);
});

siteNav.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    siteNav.classList.remove("is-open");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Open menu");
    siteNav.classList.remove("is-open");
    menuToggle.focus();
  }
});

dateInput.addEventListener("change", refreshDepartureTimes);
vehicleSelect.addEventListener("change", () => {
  updatePassengerOptions();
  updateFareEstimate();
});
originSelect.addEventListener("change", updateFareEstimate);
destinationSelect.addEventListener("change", updateFareEstimate);
passengerSelect.addEventListener("change", updateFareEstimate);

document.querySelector("#swap-route").addEventListener("click", () => {
  const origin = originSelect.value;
  originSelect.value = destinationSelect.value;
  destinationSelect.value = origin;
  updateFareEstimate();
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!bookingForm.reportValidity()) return;

  if (originSelect.value === destinationSelect.value) {
    destinationSelect.setCustomValidity("Choose a different destination town.");
    destinationSelect.reportValidity();
    destinationSelect.setCustomValidity("");
    return;
  }

  const booking = new FormData(bookingForm);
  const fare = estimateFarePerPassenger(booking.get("origin"), booking.get("destination"));
  const passengers = Number(booking.get("passengers"));
  const lines = [
    "Hello Mololine, I’d like to request a countrywide booking.",
    `From: ${booking.get("origin")}`,
    `To: ${booking.get("destination")}`,
    `Date: ${booking.get("date")}`,
    `Departure time: ${booking.get("time")}`,
    `Vehicle: ${booking.get("vehicle")}`,
    `Passengers: ${passengers}`,
    `Estimated fare: ${currency.format(fare)} per passenger (${currency.format(fare * passengers)} total; to be confirmed)`,
    `Name: ${booking.get("name").toString().trim()}`,
    `Phone: ${booking.get("phone").toString().trim()}`,
    "Please confirm availability and the final fare. No online payment has been made.",
  ];

  window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
});

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!contactForm.reportValidity()) return;

  const formData = new FormData(contactForm);
  const name = formData.get("name").toString().trim();
  const phone = formData.get("phone").toString().trim();
  const email = formData.get("email").toString().trim();
  const message = formData.get("message").toString().trim();
  const lines = [
    "Hello Mololine, I have an enquiry.",
    `Name: ${name}`,
    `Phone: ${phone}`,
    email ? `Email: ${email}` : "",
    message ? `Message: ${message}` : "",
  ].filter(Boolean);

  window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
});

document.querySelector("#year").textContent = new Date().getFullYear().toString();
