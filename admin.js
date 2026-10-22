const sheetUrl = window.MOLOLINE_INVENTORY_SHEET_URL;
const sheetLink = document.querySelector("#open-inventory-sheet");
const adminStatus = document.querySelector("#admin-status");

if (sheetUrl) {
  sheetLink.href = sheetUrl;
  sheetLink.hidden = false;
  adminStatus.textContent = "Open the private inventory sheet using your authorized staff Google account.";
}
