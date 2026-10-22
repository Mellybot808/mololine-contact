const TAB_DEPARTURES = "Departures";
const TAB_REQUESTS = "Requests";
const DEPARTURE_HEADERS = [
  "DepartureId",
  "Date",
  "Time",
  "Origin",
  "Destination",
  "VehicleType",
  "VehicleLabel",
  "SeatCount",
  "ReservedSeats",
  "Active",
];
const REQUEST_HEADERS = [
  "RequestId",
  "CreatedAt",
  "DepartureId",
  "CustomerName",
  "CustomerPhone",
  "SeatNumbers",
  "FarePerPassenger",
  "SuggestedStopsJSON",
  "Status",
  "ConfirmedAt",
];
const VEHICLE_CAPACITIES = {
  "Shuttle (7 seats)": 7,
  "Minibus (14 seats)": 14,
  "Coach (45 seats)": 45,
};
const MAX_SEATS_PER_REQUEST = 6;

function initializeInventory() {
  const spreadsheet = SpreadsheetApp.create("Mololine live seat inventory");
  spreadsheet.setSpreadsheetTimeZone("Africa/Nairobi");
  const departures = spreadsheet.getSheets()[0];
  departures.setName(TAB_DEPARTURES);
  departures.getRange(1, 1, 1, DEPARTURE_HEADERS.length).setValues([DEPARTURE_HEADERS]);
  departures.setFrozenRows(1);
  departures.getRange("B:B").setNumberFormat("yyyy-mm-dd");
  departures.getRange("C:C").setNumberFormat("HH:mm");

  const requests = spreadsheet.insertSheet(TAB_REQUESTS);
  requests.getRange(1, 1, 1, REQUEST_HEADERS.length).setValues([REQUEST_HEADERS]);
  requests.setFrozenRows(1);
  requests.getRange("B:B").setNumberFormat("yyyy-mm-dd HH:mm:ss");
  requests.getRange("J:J").setNumberFormat("yyyy-mm-dd HH:mm:ss");

  PropertiesService.getScriptProperties().setProperty("INVENTORY_SPREADSHEET_ID", spreadsheet.getId());
  Logger.log("Spreadsheet URL: " + spreadsheet.getUrl());
  Logger.log("Now deploy this project as a web app. Copy the deployed /exec URL into inventory-config.js.");
  return spreadsheet.getUrl();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Mololine inventory")
    .addItem("Confirm selected request and reserve seats", "confirmSelectedRequest")
    .addItem("Reject selected request", "rejectSelectedRequest")
    .addToUi();
}

function doGet(event) {
  const callback = event && event.parameter && event.parameter.callback;
  if (!callback || !/^[A-Za-z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput("A valid JSONP callback is required.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    const action = event.parameter.action;
    if (action !== "departures") throw new Error("Unsupported inventory action.");
    const rows = getSheet_(TAB_DEPARTURES).getDataRange().getValues();
    const pendingByDeparture = getPendingSeatRequests_();
    const departures = rows.slice(1)
      .filter((row) => isActiveFutureDeparture_(row))
      .map((row) => {
        const departureId = String(row[0]);
        const seatCount = Number(row[7]);
        const reservedSeats = parseSeatList_(row[8]);
        const pendingSeats = pendingByDeparture[departureId] || [];
        const unavailable = new Set(reservedSeats.concat(pendingSeats));
        return {
          id: departureId,
          service_date: formatDate_(row[1]),
          departure_time: formatTime_(row[2]),
          origin: String(row[3]),
          destination: String(row[4]),
          vehicle_type: String(row[5]),
          vehicle_label: String(row[6]),
          available_seats: Array.from({ length: seatCount }, (_, index) => index + 1)
            .filter((seat) => !unavailable.has(seat)),
        };
      })
      .filter((departure) => departure.available_seats.length > 0);

    return jsonp_(callback, { ok: true, departures: departures });
  } catch (error) {
    return jsonp_(callback, { ok: false, error: safeError_(error) });
  }
}

function doPost(event) {
  let response;
  try {
    if (!event || !event.parameter || event.parameter.action !== "request") {
      throw new Error("Unsupported inventory action.");
    }
    const booking = JSON.parse(event.parameter.request_json || "{}");
    response = createRequest_(booking);
  } catch (error) {
    response = { ok: false, error: safeError_(error) };
  }

  const message = JSON.stringify({
    source: "mololine-inventory",
    ok: response.ok,
    request_id: response.request_id || "",
    error: response.error || "",
  });
  return HtmlService.createHtmlOutput(
    "<!doctype html><meta charset=\"utf-8\"><script>window.parent.postMessage("
      + message
      + ", '*');</script>",
  );
}

function createRequest_(booking) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const name = String(booking.name || "").trim();
    const phone = String(booking.phone || "").trim();
    const departureId = String(booking.departure_id || "");
    const seats = Array.isArray(booking.seat_numbers)
      ? booking.seat_numbers.map(Number)
      : [];
    const fare = Number(booking.fare_per_passenger);
    if (!name || name.length > 120 || phone.length < 5 || phone.length > 40) {
      throw new Error("Enter a valid name and phone number.");
    }
    if (!seats.length || seats.length > MAX_SEATS_PER_REQUEST
        || new Set(seats).size !== seats.length
        || seats.some((seat) => !Number.isInteger(seat) || seat < 1)) {
      throw new Error("Choose one distinct valid seat for each passenger (up to six passengers).");
    }
    if (!Number.isInteger(fare) || fare < 300) throw new Error("The fare estimate is invalid.");

    const departureSheet = getSheet_(TAB_DEPARTURES);
    const departureRows = departureSheet.getDataRange().getValues();
    const departureIndex = departureRows.findIndex((row, index) => index > 0 && String(row[0]) === departureId);
    if (departureIndex < 1) throw new Error("This departure no longer exists.");
    const departure = departureRows[departureIndex];
    if (!isActiveFutureDeparture_(departure)) throw new Error("This departure is no longer available.");
    if (seats.some((seat) => seat > Number(departure[7]))) throw new Error("A requested seat is outside this vehicle's seat range.");

    const reservedSeats = parseSeatList_(departure[8]);
    const pendingSeats = getPendingSeatRequests_()[departureId] || [];
    if (seats.some((seat) => reservedSeats.includes(seat) || pendingSeats.includes(seat))) {
      throw new Error("A selected seat was just requested or reserved. Refresh and choose another seat.");
    }

    const requestId = Utilities.getUuid();
    getSheet_(TAB_REQUESTS).appendRow([
      requestId,
      new Date(),
      departureId,
      name,
      phone,
      seats.join(","),
      fare,
      JSON.stringify(Array.isArray(booking.suggested_stops) ? booking.suggested_stops : []),
      "Pending",
      "",
    ]);
    return { ok: true, request_id: requestId };
  } finally {
    lock.releaseLock();
  }
}

function confirmSelectedRequest() {
  updateSelectedRequest_("Confirmed");
}

function rejectSelectedRequest() {
  updateSelectedRequest_("Rejected");
}

function updateSelectedRequest_(newStatus) {
  const requestSheet = getSheet_(TAB_REQUESTS);
  const selected = requestSheet.getActiveRange();
  if (!selected || selected.getRow() < 2) throw new Error("Select a booking request row first.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rowIndex = selected.getRow();
    const request = requestSheet.getRange(rowIndex, 1, 1, REQUEST_HEADERS.length).getValues()[0];
    if (request[8] !== "Pending") throw new Error("Only pending booking requests can be updated.");
    if (newStatus === "Rejected") {
      requestSheet.getRange(rowIndex, 9).setValue("Rejected");
      return;
    }

    const departureSheet = getSheet_(TAB_DEPARTURES);
    const departureRows = departureSheet.getDataRange().getValues();
    const departureIndex = departureRows.findIndex((row, index) => index > 0 && String(row[0]) === String(request[2]));
    if (departureIndex < 1) throw new Error("The departure could not be found.");
    const departure = departureRows[departureIndex];
    if (!isActiveFutureDeparture_(departure)) throw new Error("The departure is inactive or has already left.");

    const seats = parseSeatList_(request[5]);
    const reserved = parseSeatList_(departure[8]);
    if (seats.some((seat) => reserved.includes(seat))) {
      throw new Error("A requested seat is already reserved. Reject this request or contact the customer to choose another seat.");
    }

    departureSheet.getRange(departureIndex + 1, 9).setValue(reserved.concat(seats).sort((a, b) => a - b).join(","));
    requestSheet.getRange(rowIndex, 9, 1, 2).setValues([["Confirmed", new Date()]]);
  } finally {
    lock.releaseLock();
  }
}

function getPendingSeatRequests_() {
  const rows = getSheet_(TAB_REQUESTS).getDataRange().getValues();
  return rows.slice(1).reduce((pending, row) => {
    if (row[8] !== "Pending") return pending;
    const departureId = String(row[2]);
    pending[departureId] = (pending[departureId] || []).concat(parseSeatList_(row[5]));
    return pending;
  }, {});
}

function isActiveFutureDeparture_(row) {
  if (row[9] !== true && String(row[9]).toUpperCase() !== "TRUE") return false;
  if (!(row[1] instanceof Date) || !(row[2] instanceof Date)) return false;
  const departureAt = new Date(
    formatDate_(row[1]) + "T" + formatTime_(row[2]) + ":00+03:00",
  );
  return departureAt.getTime() > Date.now();
}

function parseSeatList_(value) {
  return String(value || "")
    .split(",")
    .map((seat) => Number(seat.trim()))
    .filter((seat) => Number.isInteger(seat) && seat > 0);
}

function formatDate_(value) {
  return Utilities.formatDate(value, "Africa/Nairobi", "yyyy-MM-dd");
}

function formatTime_(value) {
  return Utilities.formatDate(value, "Africa/Nairobi", "HH:mm");
}

function jsonp_(callback, data) {
  const body = callback + "(" + JSON.stringify(data).replace(/</g, "\\u003c") + ");";
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function safeError_(error) {
  console.error(error);
  return error && error.message ? error.message : "The inventory request could not be completed.";
}

function getSheet_(name) {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty("INVENTORY_SPREADSHEET_ID");
  if (!spreadsheetId) throw new Error("Run initializeInventory() before using the inventory service.");
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(name);
  if (!sheet) throw new Error("Inventory sheet is missing: " + name);
  return sheet;
}
