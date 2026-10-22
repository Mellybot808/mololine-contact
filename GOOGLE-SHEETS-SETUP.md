# Google Sheets live seat inventory

The booking page reads actual scheduled departures from a private Google Sheet and refreshes availability every 20 seconds. Booking submissions create pending requests; the requested seats are hidden from other customers while staff review them. Staff confirm or reject from the Google Sheet menu. Confirmation checks availability and reserves seats under a script lock, preventing two staff actions from reserving the same seat.

## One-time setup

1. Sign in to the Google account that should own the inventory and open [Google Apps Script](https://script.google.com/).
2. Create a new standalone Apps Script project. Replace the editor contents with [`Code.gs`](./Code.gs) and save.
3. In the function picker, select `initializeInventory` and click **Run**. Review and approve the Google permission prompt. In the execution log, copy the spreadsheet URL it reports. The function creates a private spreadsheet with `Departures` and `Requests` tabs.
4. Open the spreadsheet. Keep it private; share it only with staff who may view customer names and phone numbers. Add staff as editors if they need to process bookings.
5. In Apps Script, select **Deploy → New deployment → Web app**:
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Deploy, approve the permissions, and copy the deployed URL ending in `/exec`.
6. The Apps Script project and private inventory spreadsheet have been created for the signed-in Google account. The web app has been deployed. The current deployment URL and private spreadsheet link are already entered in [`inventory-config.js`](./inventory-config.js):

   ```js
   window.MOLOLINE_INVENTORY_URL = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
   window.MOLOLINE_INVENTORY_SHEET_URL = "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit";
   ```

7. Open [`admin.html`](./admin.html) to get to the staff spreadsheet. After adding a route/date/time and vehicle, the page will show its numbered seats as available.
8. To update the deployed Apps Script later, edit and save the Apps Script project, then update the existing deployment to a new version.

## Adding departures

Add one row per vehicle in the `Departures` sheet:

| Column | Value |
|---|---|
| A `DepartureId` | A unique ID or label, e.g. `NRB-MSA-20261030-0800-01`. |
| B `Date` | A date value, e.g. `2026-10-30`. |
| C `Time` | A time value, e.g. `08:00`. |
| D `Origin` | Town name exactly as it appears in the booking form. |
| E `Destination` | Town name exactly as it appears in the booking form. |
| F `VehicleType` | `Shuttle (7 seats)`, `Minibus (14 seats)`, or `Coach (45 seats)`. |
| G `VehicleLabel` | Fleet ID or vehicle label staff can identify. |
| H `SeatCount` | `7`, `14`, or `45`, matching the vehicle type. |
| I `ReservedSeats` | Leave blank initially. Confirmed seat numbers are added here automatically. |
| J `Active` | Boolean `TRUE` while available for booking. |

Each additional vehicle at that hour gets its own row and its own departure ID.

## Processing requests

Pending requests are automatically excluded from customer seat availability. In the `Requests` tab, select a request row, then use **Mololine inventory → Confirm selected request and reserve seats** only after agreeing the booking with the customer. If they do not proceed, use **Mololine inventory → Reject selected request** to release the requested seats. Do not edit request statuses or the `ReservedSeats` column manually; use the menu so the inventory stays consistent.

The public web app needs anonymous access so GitHub Pages can request availability without exposing the private spreadsheet. It only returns active upcoming departures and seat numbers; it does not expose customer requests. Public submissions are checked and serialized by Apps Script, but a public endpoint can still receive spam. Review requests regularly and redeploy the web app when you update `Code.gs`.

The listed intermediate stops and prices are suggestions. Confirm actual stops and fares with the customer on WhatsApp; the live sheet tracks departure and seat availability only.
