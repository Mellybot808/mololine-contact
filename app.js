import { locations } from "./locations.js";

const whatsappNumber = "254733443226";
const maxPassengersPerRequest = 6;
const vehicleLayouts = [
  { id: "shuttle", label: "Shuttle (7 seats)", capacity: 7, seatsPerRow: [3, 3, 1] },
  { id: "minibus", label: "Minibus (14 seats)", capacity: 14, seatsPerRow: [4, 4, 4, 2] },
  { id: "coach", label: "Coach (45 seats)", capacity: 45, seatsPerRow: [...Array(11).fill(4), 1] },
];
const menuToggle = document.querySelector(".menu-toggle");
const siteNav = document.querySelector(".site-nav");
const contactForm = document.querySelector("#contact-form");
const bookingForm = document.querySelector("#booking-form");
const originSelect = document.querySelector("#origin");
const destinationSelect = document.querySelector("#destination");
const destinationSearch = document.querySelector("#destination-search");
const destinationOptions = document.querySelector("#destination-options");
const destinationStatus = document.querySelector("#destination-status");
const dateInput = document.querySelector("#travel-date");
const timeSelect = document.querySelector("#departure-time");
const routeStops = document.querySelector("#route-stops");
const vehicleOptions = document.querySelector("#vehicle-options");
const seatMap = document.querySelector("#seat-map");
const seatSelectionStatus = document.querySelector("#seat-selection-status");
const summaryRoute = document.querySelector("#summary-route");
const summaryDate = document.querySelector("#summary-date");
const summaryDeparture = document.querySelector("#summary-departure");
const summaryVehicle = document.querySelector("#summary-vehicle");
const summarySeats = document.querySelector("#summary-seats");

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});
let selectedVehicle = vehicleLayouts[0];
let selectedSeats = [];

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

function resetSelect(select, label) {
  select.replaceChildren();
  const option = document.createElement("option");
  option.value = "";
  option.textContent = label;
  select.append(option);
}

function populateDepartureTimes() {
  resetSelect(timeSelect, "Choose preferred time");
  for (let hour = 0; hour < 24; hour += 1) {
    const time = `${String(hour).padStart(2, "0")}:00`;
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;
    timeSelect.append(option);
  }
}

function findLocation(town) {
  return locations.find(([name]) => name === town);
}

function estimateFarePerPassenger(origin, destination) {
  const start = findLocation(origin);
  const end = findLocation(destination);
  if (!start || !end || origin === destination) return null;

  return Math.max(300, estimateBaseFare(start, end) - 200);
}

function estimateBaseFare(start, end) {
  const estimatedRoadKm = distanceKm(start, end) * 1.4;
  return Math.max(500, Math.round((250 + estimatedRoadKm * 4.5) / 100) * 100);
}

function distanceKm(start, end) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latitudeDifference = radians(end[2] - start[2]);
  const longitudeDifference = radians(end[3] - start[3]);
  const latitudeStart = radians(start[2]);
  const latitudeEnd = radians(end[2]);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(latitudeStart) * Math.cos(latitudeEnd)
    * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function suggestedStops(origin, destination, totalFare) {
  const start = findLocation(origin);
  const end = findLocation(destination);
  if (!start || !end || !totalFare) return [];

  const averageLatitude = (start[2] + end[2]) / 2;
  const scaleX = 111.32 * Math.cos((averageLatitude * Math.PI) / 180);
  const scaleY = 111.32;
  const endX = (end[3] - start[3]) * scaleX;
  const endY = (end[2] - start[2]) * scaleY;
  const routeLengthSquared = endX ** 2 + endY ** 2;
  if (!routeLengthSquared) return [];

  const candidates = locations
    .filter(([town]) => town !== origin && town !== destination)
    .map((location) => {
      const x = (location[3] - start[3]) * scaleX;
      const y = (location[2] - start[2]) * scaleY;
      const position = (x * endX + y * endY) / routeLengthSquared;
      const offset = Math.hypot(x - position * endX, y - position * endY);
      return { location, position, offset };
    })
    .filter(({ position, offset }) => position > 0.08 && position < 0.92 && offset <= 45)
    .sort((first, second) => first.position - second.position);

  const maxStops = Math.min(5, Math.floor(totalFare / 100) - 1);
  const stopCount = Math.min(candidates.length, maxStops);
  if (!stopCount) return [];

  return Array.from({ length: stopCount }, (_, index) => {
    const candidateIndex = Math.floor(((index + 1) * candidates.length) / (stopCount + 1));
    return candidates[candidateIndex].location;
  });
}

function routeLegs(origin, destination, fare) {
  const points = [
    findLocation(origin),
    ...suggestedStops(origin, destination, fare),
    findLocation(destination),
  ];
  const lengths = points.slice(1).map((point, index) => distanceKm(points[index], point));
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const fareUnits = fare / 100;
  const exactUnits = lengths.map((length) => (length / totalLength) * (fareUnits - lengths.length));
  const allocatedUnits = exactUnits.map(Math.floor);
  const remainingUnits = fareUnits - lengths.length - allocatedUnits.reduce((sum, units) => sum + units, 0);
  const remainderOrder = exactUnits
    .map((units, index) => ({ index, remainder: units - allocatedUnits[index] }))
    .sort((first, second) => second.remainder - first.remainder);

  for (let index = 0; index < remainingUnits; index += 1) {
    allocatedUnits[remainderOrder[index].index] += 1;
  }

  return points.slice(1).map((point, index) => ({
    from: points[index][0],
    to: point[0],
    fare: (allocatedUnits[index] + 1) * 100,
  }));
}

function updateRouteStops(fare) {
  routeStops.replaceChildren();
  if (!fare) {
    const item = document.createElement("li");
    item.textContent = "Choose a route to see suggested stops and leg fares.";
    routeStops.append(item);
    return;
  }

  routeLegs(originSelect.value, destinationSelect.value, fare).forEach((leg) => {
    const item = document.createElement("li");
    item.textContent = `${leg.from} → ${leg.to}: ${currency.format(leg.fare)} per passenger`;
    routeStops.append(item);
  });
}

function updateTripSummary() {
  const origin = findLocation(originSelect.value);
  const destination = findLocation(destinationSelect.value);
  summaryRoute.textContent = origin && destination
    ? `${origin[0]} · ${origin[1]} County → ${destination[0]} · ${destination[1]} County`
    : "Choose your destination";
  summaryDate.textContent = dateInput.value || "—";
  summaryDeparture.textContent = timeSelect.value || "—";
  summaryVehicle.textContent = selectedVehicle.label;
  summarySeats.textContent = selectedSeats.length ? selectedSeats.join(", ") : "— none selected —";
}

function updateRouteDetails() {
  const fare = estimateFarePerPassenger(originSelect.value, destinationSelect.value);
  if (originSelect.value && originSelect.value === destinationSelect.value) {
    updateRouteStops(null);
  } else {
    updateRouteStops(fare);
  }
  renderDestinationOptions();
  updateTripSummary();
}

function renderDestinationOptions() {
  const query = destinationSearch.value.trim().toLocaleLowerCase();
  const fragment = document.createDocumentFragment();
  const matchingLocations = locations.filter(([town, county]) => (
    `${town} ${county} county`.toLocaleLowerCase().includes(query)
  ));

  matchingLocations.forEach(([town, county]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "destination-option";
    button.setAttribute("aria-pressed", String(town === destinationSelect.value));
    button.disabled = town === originSelect.value;

    const route = document.createElement("span");
    route.className = "destination-route";
    route.textContent = town === originSelect.value
      ? `${town} · current departure`
      : `${originSelect.value || "Choose departure"} → ${town}`;
    const region = document.createElement("span");
    region.className = "destination-county";
    region.textContent = `${county} County`;
    button.append(route, region);
    button.addEventListener("click", () => {
      destinationSelect.value = town;
      destinationStatus.textContent = `${town}, ${county} County selected.`;
      updateRouteDetails();
    });
    fragment.append(button);
  });

  destinationOptions.replaceChildren(fragment);
  if (!matchingLocations.length) {
    destinationStatus.textContent = "No destinations match your search.";
  } else if (destinationSelect.value) {
    const selectedLocation = findLocation(destinationSelect.value);
    destinationStatus.textContent = `${selectedLocation[0]}, ${selectedLocation[1]} County selected.`;
  } else if (!destinationSelect.value) {
    destinationStatus.textContent = `Showing ${matchingLocations.length} of ${locations.length} county towns. Your departure town is not selectable as a destination.`;
  }
}

function renderVehicleOptions() {
  vehicleOptions.replaceChildren();
  vehicleLayouts.forEach((vehicle) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vehicle-option";
    button.setAttribute("aria-pressed", String(vehicle.id === selectedVehicle.id));
    button.textContent = vehicle.label;
    button.addEventListener("click", () => {
      selectedVehicle = vehicle;
      selectedSeats = [];
      renderVehicleOptions();
      renderSeatMap();
      updateTripSummary();
    });
    vehicleOptions.append(button);
  });
}

function renderSeatMap() {
  seatMap.replaceChildren();
  seatMap.className = `seat-grid seat-grid-${selectedVehicle.id}`;
  let seatNumber = 0;

  selectedVehicle.seatsPerRow.forEach((seatCount, rowIndex) => {
    for (let columnIndex = 0; columnIndex < seatCount; columnIndex += 1) {
      seatNumber += 1;
      const seat = `${rowIndex + 1}${String.fromCharCode(65 + columnIndex)}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "seat-button";
      button.textContent = seat;
      button.setAttribute("aria-label", `Seat ${seat}`);
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => toggleSeat(seat, button));
      seatMap.append(button);
    }
  });
  seatMap.setAttribute("aria-label", `${selectedVehicle.label}, ${seatNumber} selectable seats`);
  updateSeatSelectionStatus();
}

function toggleSeat(seat, button) {
  if (selectedSeats.includes(seat)) {
    selectedSeats = selectedSeats.filter((selected) => selected !== seat);
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  } else if (selectedSeats.length < maxPassengersPerRequest) {
    selectedSeats.push(seat);
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
  } else {
    seatSelectionStatus.textContent = `You can select up to ${maxPassengersPerRequest} seats per request.`;
    return;
  }

  updateSeatSelectionStatus();
  updateTripSummary();
}

function updateSeatSelectionStatus() {
  seatSelectionStatus.textContent = selectedSeats.length
    ? `${selectedSeats.length} ${selectedSeats.length === 1 ? "seat" : "seats"} selected: ${selectedSeats.join(", ")}`
    : "No seats selected";
}

function applyRouteFromQuery() {
  const requestedRoute = new URLSearchParams(window.location.search).get("route");
  if (!requestedRoute) return;

  const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const [origin] of locations) {
    for (const [destination] of locations) {
      if (`${slugify(origin)}-${slugify(destination)}` === requestedRoute) {
        originSelect.value = origin;
        destinationSelect.value = destination;
        return;
      }
    }
  }
}

addLocationOptions(originSelect);
dateInput.min = localDateValue(new Date());
dateInput.value = dateInput.min;
populateDepartureTimes();
applyRouteFromQuery();
renderDestinationOptions();
renderVehicleOptions();
renderSeatMap();
updateRouteDetails();

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

originSelect.addEventListener("change", updateRouteDetails);
destinationSelect.addEventListener("change", updateRouteDetails);
destinationSearch.addEventListener("input", renderDestinationOptions);
dateInput.addEventListener("change", updateTripSummary);
timeSelect.addEventListener("change", updateTripSummary);

document.querySelector("#swap-route").addEventListener("click", () => {
  const origin = originSelect.value;
  originSelect.value = destinationSelect.value;
  destinationSelect.value = origin;
  updateRouteDetails();
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!destinationSelect.value) {
    destinationStatus.textContent = "Choose a destination from the list before continuing.";
    destinationSearch.focus();
    return;
  }
  if (!bookingForm.reportValidity()) return;

  if (originSelect.value === destinationSelect.value) {
    destinationSelect.setCustomValidity("Choose a different destination town.");
    destinationSelect.reportValidity();
    destinationSelect.setCustomValidity("");
    return;
  }
  if (!selectedSeats.length) {
    seatSelectionStatus.textContent = "Choose at least one seat before continuing.";
    seatMap.querySelector(".seat-button")?.focus();
    return;
  }

  const booking = new FormData(bookingForm);
  const fare = estimateFarePerPassenger(booking.get("origin"), booking.get("destination"));
  const legs = routeLegs(booking.get("origin"), booking.get("destination"), fare);
  const lines = [
    "Hello Mololine, I would like to request a countrywide booking.",
    `From: ${booking.get("origin")}`,
    `To: ${booking.get("destination")}`,
    `Date: ${booking.get("date")}`,
    `Preferred departure time: ${booking.get("time")}`,
    `Vehicle: ${selectedVehicle.label}`,
    `Passengers: ${selectedSeats.length}`,
    `Requested seat(s): ${selectedSeats.join(", ")}`,
    `Suggested route stops and leg fares: ${legs
      .map((leg) => `${leg.from} to ${leg.to}: ${currency.format(leg.fare)} per passenger`)
      .join("; ")}`,
    `Name: ${booking.get("name").toString().trim()}`,
    `Phone: ${booking.get("phone").toString().trim()}`,
    "These seat choices are requests only, not live availability or reservations. Please confirm the seats, departure and fare on WhatsApp. No online payment has been made.",
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
