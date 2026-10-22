import { locations } from "./locations.js";

const whatsappNumber = "254733443226";
const maxPassengersPerRequest = 6;
const inventoryUrl = window.MOLOLINE_INVENTORY_URL;
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
const routeStops = document.querySelector("#route-stops");
const seatRequests = document.querySelector("#seat-requests");
const inventoryStatus = document.querySelector("#inventory-status");

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});
let availableDepartures = [];
let selectedDeparture = null;
let inventoryRequest = 0;

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

function clearDepartures() {
  availableDepartures = [];
  selectedDeparture = null;
  resetSelect(timeSelect, "Choose a departure time");
  resetSelect(vehicleSelect, "Choose a departure first");
  resetSelect(passengerSelect, "Choose a departure first");
  updateSeatRequests();
}

async function refreshDepartures() {
  const requestId = ++inventoryRequest;
  clearDepartures();

  if (!inventoryUrl) {
    inventoryStatus.textContent = "Live seat inventory is not configured yet. Please contact us on WhatsApp to check availability.";
    return;
  }
  if (!originSelect.value || !destinationSelect.value || !dateInput.value) {
    inventoryStatus.textContent = "Choose a route and date to check live departures.";
    return;
  }
  if (originSelect.value === destinationSelect.value) {
    inventoryStatus.textContent = "Choose two different towns to check live departures.";
    return;
  }

  inventoryStatus.textContent = "Checking live departures…";
  try {
    const data = await loadDepartures();
    if (requestId !== inventoryRequest) return;
    const now = new Date();
    availableDepartures = data
      .filter((departure) => (
        departure.origin === originSelect.value
        && departure.destination === destinationSelect.value
        && departure.service_date === dateInput.value
        && departure.available_seats.length > 0
        && (departure.service_date !== localDateValue(now)
          || departure.departure_time > `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`)
      ))
      .map((departure) => ({
        ...departure,
        availableSeats: departure.available_seats.sort((first, second) => first - second),
      }))
      .sort((first, second) => first.departure_time.localeCompare(second.departure_time));
  } catch (error) {
    if (requestId === inventoryRequest) {
      inventoryStatus.textContent = `Could not load live seat availability: ${error.message}`;
    }
    return;
  }

  const departureTimes = [...new Set(availableDepartures.map((departure) => departure.departure_time.slice(0, 5)))];
  departureTimes.forEach((time) => {
    const departuresAtTime = availableDepartures.filter((departure) => departure.departure_time.startsWith(time));
    const option = document.createElement("option");
    option.value = time;
    option.textContent = `${time} · ${departuresAtTime.reduce((count, trip) => count + trip.availableSeats.length, 0)} seats available`;
    timeSelect.append(option);
  });

  inventoryStatus.textContent = availableDepartures.length
    ? `${availableDepartures.length} live vehicle departure(s) found. Inventory refreshes every 20 seconds. Seats are reserved after staff confirmation.`
    : "No live departures with available seats were found for this route and date. Contact us on WhatsApp.";
}

function loadDepartures() {
  return new Promise((resolve, reject) => {
    const callbackName = `mololineInventory_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Inventory service did not respond. Please try again."));
    }, 12000);

    window[callbackName] = (response) => {
      cleanup();
      if (!response.ok) {
        reject(new Error(response.error || "Inventory service returned an error."));
        return;
      }
      resolve(response.departures);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error("Could not connect to the inventory service."));
    };

    const url = new URL(inventoryUrl);
    url.searchParams.set("action", "departures");
    url.searchParams.set("callback", callbackName);
    url.searchParams.set("_", Date.now().toString());
    script.src = url.toString();
    document.head.append(script);
  });
}

function updateVehicleOptions() {
  selectedDeparture = null;
  resetSelect(vehicleSelect, "Choose a vehicle");
  resetSelect(passengerSelect, "Choose a vehicle first");
  seatRequests.replaceChildren();

  const departuresAtTime = availableDepartures.filter(
    (departure) => departure.departure_time.startsWith(timeSelect.value),
  );
  departuresAtTime.forEach((departure) => {
    const option = document.createElement("option");
    option.value = departure.id;
    option.textContent = `${departure.vehicle_type} · ${departure.vehicle_label} · ${departure.availableSeats.length} seats available`;
    vehicleSelect.append(option);
  });
}

function updatePassengerOptions() {
  const capacity = selectedDeparture?.availableSeats.length || 0;
  const currentPassengers = Number(passengerSelect.value) || 1;
  passengerSelect.replaceChildren();

  if (!capacity) {
    resetSelect(passengerSelect, "Choose a vehicle first");
    return;
  }

  for (let count = 1; count <= Math.min(capacity, maxPassengersPerRequest); count += 1) {
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

  return Math.max(300, estimateBaseFare(start, end) - 200);
}

function estimateBaseFare(start, end) {
  const straightLineKm = distanceKm(start, end);
  const estimatedRoadKm = straightLineKm * 1.4;
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

function updateFareEstimate() {
  const fare = estimateFarePerPassenger(originSelect.value, destinationSelect.value);
  if (originSelect.value && originSelect.value === destinationSelect.value) {
    fareEstimate.textContent = "Choose a different destination";
    updateRouteStops(null);
    return;
  }
  fareEstimate.textContent = fare === null ? "Choose a route" : `${currency.format(fare)} per passenger`;
  updateRouteStops(fare);
}

function updateSeatRequests() {
  const passengers = Number(passengerSelect.value) || 1;
  const previous = Array.from(seatRequests.querySelectorAll("select")).map((select) => select.value);
  seatRequests.replaceChildren();

  if (!selectedDeparture) {
    const note = document.createElement("p");
    note.className = "booking-extra-note";
    note.textContent = "Select a live departure and vehicle to see available seat numbers.";
    seatRequests.append(note);
    return;
  }

  for (let passenger = 0; passenger < passengers; passenger += 1) {
    const label = document.createElement("label");
    const labelText = document.createElement("span");
    const select = document.createElement("select");
    labelText.textContent = `Passenger ${passenger + 1} seat`;
    select.name = "seatNumber";
    select.required = true;
    select.setAttribute("aria-label", `Passenger ${passenger + 1} seat number`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose seat number";
    select.append(placeholder);

    selectedDeparture.availableSeats.forEach((seat) => {
      const option = document.createElement("option");
      option.value = String(seat);
      option.textContent = `Seat ${seat}`;
      select.append(option);
    });

    if (previous[passenger]) select.value = previous[passenger];
    select.addEventListener("change", updateSeatAvailability);
    label.append(labelText, select);
    seatRequests.append(label);
  }

  updateSeatAvailability();
}

function updateSeatAvailability() {
  const selects = Array.from(seatRequests.querySelectorAll("select"));
  const chosenSeats = selects.map((select) => select.value).filter(Boolean);

  selects.forEach((select) => {
    const selectedByOthers = new Set(chosenSeats.filter((seat) => seat !== select.value));
    Array.from(select.options).forEach((option) => {
      option.disabled = selectedByOthers.has(option.value);
    });
  });
}

addLocationOptions(originSelect);
addLocationOptions(destinationSelect);
dateInput.min = localDateValue(new Date());
dateInput.value = dateInput.min;
updateSeatRequests();
updateFareEstimate();
refreshDepartures();

window.setInterval(() => {
  if (document.visibilityState === "visible") refreshDepartures();
}, 20000);

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

dateInput.addEventListener("change", refreshDepartures);
originSelect.addEventListener("change", () => {
  updateFareEstimate();
  refreshDepartures();
});
destinationSelect.addEventListener("change", () => {
  updateFareEstimate();
  refreshDepartures();
});
timeSelect.addEventListener("change", updateVehicleOptions);
vehicleSelect.addEventListener("change", () => {
  selectedDeparture = availableDepartures.find((departure) => departure.id === vehicleSelect.value) || null;
  updatePassengerOptions();
  updateSeatRequests();
  updateFareEstimate();
});
passengerSelect.addEventListener("change", () => {
  updateSeatRequests();
  updateFareEstimate();
});

document.querySelector("#swap-route").addEventListener("click", () => {
  const origin = originSelect.value;
  originSelect.value = destinationSelect.value;
  destinationSelect.value = origin;
  updateFareEstimate();
  refreshDepartures();
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

  if (!inventoryUrl || !selectedDeparture) {
    inventoryStatus.textContent = "Choose a departure with live available seats before requesting a booking.";
    return;
  }

  const booking = new FormData(bookingForm);
  const fare = estimateFarePerPassenger(booking.get("origin"), booking.get("destination"));
  const passengers = Number(booking.get("passengers"));
  const seatNumbers = booking.getAll("seatNumber").map(Number);
  const legs = routeLegs(booking.get("origin"), booking.get("destination"), fare);
  const departure = selectedDeparture;
  const submitButton = bookingForm.querySelector(".booking-submit");
  submitButton.disabled = true;
  inventoryStatus.textContent = "Sending your seat request…";

  const request = {
    departure_id: departure.id,
    name: booking.get("name").toString().trim(),
    phone: booking.get("phone").toString().trim(),
    seat_numbers: seatNumbers,
    fare_per_passenger: fare,
    suggested_stops: legs.map((leg) => ({
      from: leg.from,
      to: leg.to,
      fare: leg.fare,
    })),
  };
  const frame = document.createElement("iframe");
  const form = document.createElement("form");
  const postComplete = (messageEvent) => {
    if (messageEvent.source !== frame.contentWindow) return;
    if (!["script.google.com", "script.googleusercontent.com"].includes(new URL(messageEvent.origin).hostname)) return;
    window.removeEventListener("message", postComplete);
    window.clearTimeout(postTimeout);
    frame.remove();
    form.remove();
    submitButton.disabled = false;
    if (!messageEvent.data || messageEvent.data.source !== "mololine-inventory") return;
    if (!messageEvent.data.ok) {
      inventoryStatus.textContent = `Could not submit request: ${messageEvent.data.error}. Refresh availability and try again.`;
      refreshDepartures();
      return;
    }

    const lines = [
      "Hello Mololine, I have submitted a countrywide booking request.",
      `Request reference: ${messageEvent.data.request_id}`,
      `From: ${booking.get("origin")}`,
      `To: ${booking.get("destination")}`,
      `Date: ${booking.get("date")}`,
      `Departure time: ${departure.departure_time}`,
      `Vehicle: ${departure.vehicle_type} · ${departure.vehicle_label}`,
      `Passengers: ${passengers}`,
      `Requested seat number(s): ${seatNumbers.join(", ")}`,
      `Suggested route stops and leg fares: ${legs
        .map((leg) => `${leg.from} to ${leg.to}: ${currency.format(leg.fare)} per passenger`)
        .join("; ")}`,
      `Estimated fare after KES 200 discount: ${currency.format(fare)} per passenger (${currency.format(fare * passengers)} total; to be confirmed)`,
      `Name: ${request.name}`,
      `Phone: ${request.phone}`,
      "This is a request only; please confirm the fare and final booking on WhatsApp. No online payment has been made.",
    ];

    window.location.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join("\n"))}`;
  };
  const postTimeout = window.setTimeout(() => {
    window.removeEventListener("message", postComplete);
    frame.remove();
    form.remove();
    submitButton.disabled = false;
    inventoryStatus.textContent = "The inventory service did not confirm that your request was received. Please contact us on WhatsApp.";
  }, 20000);

  window.addEventListener("message", postComplete);
  frame.name = `mololine-request-${Date.now()}`;
  frame.hidden = true;
  frame.src = "about:blank";
  form.hidden = true;
  form.method = "post";
  form.target = frame.name;
  form.action = inventoryUrl;
  const actionField = document.createElement("input");
  actionField.name = "action";
  actionField.value = "request";
  const requestField = document.createElement("input");
  requestField.name = "request_json";
  requestField.value = JSON.stringify(request);
  form.append(actionField, requestField);
  document.body.append(frame, form);
  window.setTimeout(() => form.submit(), 0);
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
