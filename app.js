const STORAGE_KEY = "travel-splitter-state-v3";
const LEGACY_KEYS = ["travel-splitter-state-v2", "travel-splitter-state"];
const CURRENCIES = ["KRW", "JPY", "USD", "THB", "VND", "CNY", "EUR"];
const DEFAULT_RATES = { KRW: 1, JPY: 9.5, USD: 1540, THB: 42, VND: 0.06, CNY: 212, EUR: 1800 };
const DATE_COLORS = ["#ffb000", "#4aa3f0", "#8b5cf6", "#0f8a61", "#f97316", "#ec4899", "#14b8a6", "#f472b6"];
const DEFAULT_PEOPLE = ["나", "동행 1"];
const KRW_SETTLEMENT_ROUND_UNIT = 10;
const DEFAULT_ACCOUNT = {
  bank: "",
  number: "",
  holder: "",
};

const appState = {
  activeTripId: "",
  trips: [],
};

const uiState = {
  expenseSortKey: "date",
  expenseSortDirection: "desc",
  editingExpenseId: "",
  selectedExpenseIds: new Set(),
  bulkPanelOpen: false,
};

let state = createTrip("새 정산", []);
let personInputComposing = false;
let lastPersonAdd = { name: "", time: 0 };

const els = {
  appTitle: document.querySelector("#appTitle"),
  appSubtitle: document.querySelector("#appSubtitle"),
  tripSelect: document.querySelector("#tripSelect"),
  newTripButton: document.querySelector("#newTripButton"),
  duplicateTripButton: document.querySelector("#duplicateTripButton"),
  deleteTripButton: document.querySelector("#deleteTripButton"),
  clearAllButton: document.querySelector("#clearAllButton"),
  tripName: document.querySelector("#tripName"),
  tripDate: document.querySelector("#tripDate"),
  tripStartDate: document.querySelector("#tripStartDate"),
  tripEndDate: document.querySelector("#tripEndDate"),
  settlementCurrency: document.querySelector("#settlementCurrency"),
  jpyRate: document.querySelector("#jpyRate"),
  usdRate: document.querySelector("#usdRate"),
  thbRate: document.querySelector("#thbRate"),
  vndRate: document.querySelector("#vndRate"),
  cnyRate: document.querySelector("#cnyRate"),
  eurRate: document.querySelector("#eurRate"),
  peopleCount: document.querySelector("#peopleCount"),
  peopleList: document.querySelector("#peopleList"),
  personInput: document.querySelector("#personInput"),
  addPersonButton: document.querySelector("#addPersonButton"),
  totalSpend: document.querySelector("#totalSpend"),
  perPerson: document.querySelector("#perPerson"),
  settlementCount: document.querySelector("#settlementCount"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseTitle: document.querySelector("#expenseTitle"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseCurrency: document.querySelector("#expenseCurrency"),
  expenseDate: document.querySelector("#expenseDate"),
  expensePayer: document.querySelector("#expensePayer"),
  expenseSummary: document.querySelector("#expenseSummary"),
  expenseSortKey: document.querySelector("#expenseSortKey"),
  expenseSortDirection: document.querySelector("#expenseSortDirection"),
  expenseList: document.querySelector("#expenseList"),
  bulkToggleButton: document.querySelector("#bulkToggleButton"),
  bulkPanel: document.querySelector("#bulkPanel"),
  bulkSelectionCount: document.querySelector("#bulkSelectionCount"),
  selectAllExpensesButton: document.querySelector("#selectAllExpensesButton"),
  clearExpenseSelectionButton: document.querySelector("#clearExpenseSelectionButton"),
  bulkCategory: document.querySelector("#bulkCategory"),
  bulkPayer: document.querySelector("#bulkPayer"),
  bulkSplitMode: document.querySelector("#bulkSplitMode"),
  bulkSplitPerson: document.querySelector("#bulkSplitPerson"),
  bulkShareInputs: document.querySelector("#bulkShareInputs"),
  bulkHint: document.querySelector("#bulkHint"),
  applyBulkButton: document.querySelector("#applyBulkButton"),
  balanceList: document.querySelector("#balanceList"),
  settlementList: document.querySelector("#settlementList"),
  settlementSummary: document.querySelector("#settlementSummary"),
  paymentTable: document.querySelector("#paymentTable"),
  reportTripName: document.querySelector("#reportTripName"),
  reportSubtitle: document.querySelector("#reportSubtitle"),
  settlementReport: document.querySelector("#settlementReport"),
  accountBank: document.querySelector("#accountBank"),
  accountNumber: document.querySelector("#accountNumber"),
  accountHolder: document.querySelector("#accountHolder"),
  accountLine: document.querySelector("#accountLine"),
  copyAccountButton: document.querySelector("#copyAccountButton"),
  exportImageButton: document.querySelector("#exportImageButton"),
  exportDataButton: document.querySelector("#exportDataButton"),
  dataFileInput: document.querySelector("#dataFileInput"),
  shareButton: document.querySelector("#shareButton"),
  shareBox: document.querySelector("#shareBox"),
  shareUrl: document.querySelector("#shareUrl"),
  shareStatus: document.querySelector("#shareStatus"),
  copyButton: document.querySelector("#copyButton"),
  resetButton: document.querySelector("#resetButton"),
  ledgerFileInput: document.querySelector("#ledgerFileInput"),
  ledgerText: document.querySelector("#ledgerText"),
  parseTextButton: document.querySelector("#parseTextButton"),
  clearTextButton: document.querySelector("#clearTextButton"),
  importHint: document.querySelector("#importHint"),
};

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createTrip(name = nextTripName(), expenses = []) {
  return normalizeTrip({
    id: uid("trip"),
    tripName: name,
    tripDate: new Date().toISOString().slice(0, 10),
    tripStartDate: "",
    tripEndDate: "",
    settlementCurrency: "KRW",
    rates: { ...DEFAULT_RATES },
    people: [...DEFAULT_PEOPLE],
    account: { ...DEFAULT_ACCOUNT },
    expenses,
  });
}

function createInitialTrip() {
  return createTrip("정산 1", []);
}

function nextTripName() {
  return `정산 ${appState.trips.length + 1}`;
}

function normalizeTrip(trip) {
  const people = normalizePeople(trip.people);
  const settlementCurrency = CURRENCIES.includes(trip.settlementCurrency || trip.currency) ? (trip.settlementCurrency || trip.currency) : "KRW";
  const normalized = {
    id: trip.id || uid("trip"),
    tripName: trip.tripName || trip.name || nextTripName(),
    tripDate: trip.tripDate || trip.date || new Date().toISOString().slice(0, 10),
    tripStartDate: normalizeDateInput(trip.tripStartDate || trip.startDate),
    tripEndDate: normalizeDateInput(trip.tripEndDate || trip.endDate),
    settlementCurrency,
    rates: normalizeRates(trip.rates),
    people,
    account: normalizeAccount(trip.account),
    expenses: [],
  };
  normalized.expenses = Array.isArray(trip.expenses)
    ? trip.expenses.map((expense) => normalizeExpense(expense, normalized))
    : [];
  return normalized;
}

function normalizePeople(people) {
  if (!Array.isArray(people) || !people.length) return [...DEFAULT_PEOPLE];
  return [...new Set(people)];
}

function normalizeAccount(account = {}) {
  return {
    bank: account.bank || DEFAULT_ACCOUNT.bank,
    number: account.number || DEFAULT_ACCOUNT.number,
    holder: account.holder || DEFAULT_ACCOUNT.holder,
  };
}

function normalizeRates(rates = {}) {
  const normalized = { ...DEFAULT_RATES, ...rates };
  if (Number(normalized.USD) === 1390) normalized.USD = DEFAULT_RATES.USD;
  return normalized;
}

function normalizeShares(shares = {}, people = state.people) {
  return Object.fromEntries(Object.entries(shares || {})
    .filter(([name, value]) => people.includes(name) && Number(value) > 0)
    .map(([name, value]) => [name, Number(value)]));
}

function normalizeExpense(expense, trip = state) {
  const fallbackCurrency = expense.currency || expense.originalCurrency || trip.settlementCurrency || "KRW";
  const normalizedShares = normalizeShares(expense.shares, trip.people);
  const sharePeople = Object.keys(normalizedShares);
  const participants = sharePeople.length
    ? sharePeople
    : Array.isArray(expense.participants) && expense.participants.length
      ? expense.participants.filter((person) => trip.people.includes(person))
      : [...trip.people];
  return {
    id: expense.id || uid("expense"),
    title: cleanTitle(expense.title || "무제") || "무제",
    amount: Number(expense.amount) || 0,
    currency: CURRENCIES.includes(fallbackCurrency) ? fallbackCurrency : "KRW",
    convertedAmountKrw: Number(expense.convertedAmountKrw) > 0 ? Number(expense.convertedAmountKrw) : null,
    date: expense.date || trip.tripDate || new Date().toISOString().slice(0, 10),
    time: normalizeTime(expense.time),
    payer: trip.people.includes(expense.payer) ? expense.payer : trip.people[0],
    category: expense.category || "여행",
    participants,
    shares: sharePeople.length ? normalizedShares : null,
    included: expense.included !== false,
    review: Boolean(expense.review),
  };
}

function setActiveTrip(id) {
  const found = appState.trips.find((trip) => trip.id === id) || appState.trips[0];
  state = found || createTrip();
  appState.activeTripId = state.id;
  uiState.selectedExpenseIds.clear();
  uiState.editingExpenseId = "";
}

function resetImportPanel(message = "엑셀 파일을 올리거나 엑셀에서 복사한 내용을 붙여넣으세요.") {
  if (els.ledgerText) els.ledgerText.value = "";
  if (els.ledgerFileInput) els.ledgerFileInput.value = "";
  if (els.importHint) els.importHint.textContent = message;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadState() {
  const shared = readSharedState();
  if (shared) {
    appState.trips = [normalizeTrip(shared)];
    appState.activeTripId = appState.trips[0].id;
    setActiveTrip(appState.activeTripId);
    saveState();
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    return;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    appState.trips = Array.isArray(parsed.trips) ? parsed.trips.map(normalizeTrip) : [];
    appState.activeTripId = parsed.activeTripId || appState.trips[0]?.id || "";
  } else {
    const legacy = LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    if (legacy) {
      appState.trips = [normalizeTrip(JSON.parse(legacy))];
      appState.activeTripId = appState.trips[0].id;
    }
  }

  if (!appState.trips.length) {
    appState.trips = [createInitialTrip()];
    appState.activeTripId = appState.trips[0].id;
  }
  setActiveTrip(appState.activeTripId);
}

function readSharedState() {
  const match = location.hash.match(/share=([^&]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")))));
  } catch {
    return null;
  }
}

function encodeShare() {
  const payload = JSON.stringify({
    tripName: state.tripName,
    tripDate: state.tripDate,
    tripStartDate: state.tripStartDate,
    tripEndDate: state.tripEndDate,
    settlementCurrency: state.settlementCurrency,
    rates: state.rates,
    people: state.people,
    account: state.account,
    expenses: state.expenses,
  });
  return btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function rateOf(currency) {
  return Number(state.rates[currency]) || 1;
}

function toSettlementAmount(expense) {
  const amountInKrw = Number(expense.convertedAmountKrw) > 0
    ? Number(expense.convertedAmountKrw)
    : Number(expense.amount) * rateOf(expense.currency);
  return amountInKrw / rateOf(state.settlementCurrency);
}

function formatMoney(value, currency = state.settlementCurrency) {
  const number = Number(value) || 0;
  const digits = ["USD", "EUR", "CNY", "THB"].includes(currency) ? 2 : 0;
  const formatted = number.toLocaleString("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (currency === "KRW") return `${formatted}원`;
  if (currency === "JPY") return `JP¥ ${formatted}`;
  if (currency === "USD") return `US$ ${formatted}`;
  if (currency === "THB") return `฿ ${formatted}`;
  if (currency === "VND") return `₫ ${formatted}`;
  if (currency === "CNY") return `CN¥ ${formatted}`;
  if (currency === "EUR") return `€ ${formatted}`;
  return `${currency} ${formatted}`;
}

function roundSettlementDisplayAmount(value, currency = state.settlementCurrency) {
  const number = Number(value) || 0;
  if (currency === "KRW") return Math.round(number / KRW_SETTLEMENT_ROUND_UNIT) * KRW_SETTLEMENT_ROUND_UNIT;
  return number;
}

function formatSettlementMoney(value, currency = state.settlementCurrency) {
  return formatMoney(roundSettlementDisplayAmount(value, currency), currency);
}

function formatExpenseMoney(expense) {
  const original = formatMoney(expense.amount, expense.currency);
  const converted = formatMoney(toSettlementAmount(expense));
  return expense.currency === state.settlementCurrency ? original : `${original} · ${converted}`;
}

function formatExpenseMoneyParts(expense) {
  const original = formatMoney(expense.amount, expense.currency);
  const converted = formatMoney(toSettlementAmount(expense));
  return {
    original,
    converted: expense.currency === state.settlementCurrency ? "" : converted,
  };
}

function normalizeTime(value) {
  const text = String(value || "").trim();
  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeDateInput(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
  if (!match) return "";
  return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
}

function expenseTimestamp(expense) {
  return `${expense.date || "0000-00-00"}T${expense.time || "00:00"}`;
}

function formatShortDate(date) {
  const match = String(date || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return date || "-";
  return `${Number(match[2])}/${Number(match[3])}`;
}

function formatLongDate(date) {
  const match = String(date || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return date || "-";
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function formatKoreanDate(date) {
  const match = String(date || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return date || "-";
  return `${Number(match[2])}월 ${Number(match[3])}일`;
}

function expenseDateRange(trip = state) {
  const dates = (trip.expenses || []).map((expense) => expense.date).filter(Boolean).sort();
  if (!dates.length) return { start: trip.tripDate, end: trip.tripDate };
  return { start: dates[0], end: dates[dates.length - 1] };
}

function tripDateRange(trip = state) {
  const auto = expenseDateRange(trip);
  const start = normalizeDateInput(trip.tripStartDate) || auto.start;
  const end = normalizeDateInput(trip.tripEndDate) || normalizeDateInput(trip.tripStartDate) || auto.end || start;
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
}

function tripPeriodLabel(trip = state) {
  const { start, end } = tripDateRange(trip);
  if (!start) return "일정 없음";
  if (!end || start === end) return formatKoreanDate(start);
  return `${formatKoreanDate(start)} - ${formatKoreanDate(end)}`;
}

function dateColor(date) {
  const key = String(date || "");
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % DATE_COLORS.length;
  }
  return DATE_COLORS[hash];
}

function calculate() {
  const balances = Object.fromEntries(state.people.map((name) => [name, 0]));
  const paid = Object.fromEntries(state.people.map((name) => [name, 0]));
  const owed = Object.fromEntries(state.people.map((name) => [name, 0]));
  let total = 0;

  state.expenses.filter((expense) => expense.included !== false).forEach((expense) => {
    const settlementAmount = toSettlementAmount(expense);
    const splitters = expenseShareEntries(expense).filter(({ name }) => balances[name] !== undefined);
    const totalWeight = splitters.reduce((sum, item) => sum + item.weight, 0) || 1;
    total += settlementAmount;
    balances[expense.payer] = (balances[expense.payer] || 0) + settlementAmount;
    paid[expense.payer] = (paid[expense.payer] || 0) + settlementAmount;
    splitters.forEach(({ name, weight }) => {
      const share = settlementAmount * (weight / totalWeight);
      balances[name] = (balances[name] || 0) - share;
      owed[name] = (owed[name] || 0) + share;
    });
  });

  return { total, balances, paid, owed, settlements: settleBalances(balances) };
}

function expenseShareEntries(expense) {
  const shares = normalizeShares(expense.shares, state.people);
  const shareEntries = Object.entries(shares).map(([name, weight]) => ({ name, weight }));
  if (shareEntries.length) return shareEntries;
  const participants = expense.participants?.filter((name) => state.people.includes(name));
  const splitters = participants?.length ? participants : state.people;
  return splitters.map((name) => ({ name, weight: 1 }));
}

function splitLabel(expense) {
  const entries = expenseShareEntries(expense);
  if (entries.length === 1) return `${entries[0].name} 부담`;
  const equal = entries.every((entry) => entry.weight === entries[0].weight);
  return equal ? `${entries.length}명 분할` : "가중 분담";
}

function expenseShareInputValues(expense) {
  return Object.fromEntries(expenseShareEntries(expense).map(({ name, weight }) => [name, weight]));
}

function settleBalances(balances) {
  const precision = ["USD", "EUR", "CNY", "THB"].includes(state.settlementCurrency) ? 100 : 1;
  const creditors = [];
  const debtors = [];
  Object.entries(balances).forEach(([name, amount]) => {
    const rounded = Math.round(amount * precision) / precision;
    if (rounded > 0) creditors.push({ name, amount: rounded });
    if (rounded < 0) debtors.push({ name, amount: Math.abs(rounded) });
  });

  const settlements = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amount = Math.min(creditor.amount, debtor.amount);
    if (amount > 0) settlements.push({ from: debtor.name, to: creditor.name, amount });
    creditor.amount = Math.round((creditor.amount - amount) * precision) / precision;
    debtor.amount = Math.round((debtor.amount - amount) * precision) / precision;
    if (creditor.amount <= 0) creditorIndex += 1;
    if (debtor.amount <= 0) debtorIndex += 1;
  }
  return settlements;
}

function render() {
  const visibleTripRange = tripDateRange();
  renderHeader();
  els.tripName.value = state.tripName;
  els.tripDate.value = state.tripDate;
  els.tripStartDate.value = state.tripStartDate || visibleTripRange.start || state.tripDate;
  els.tripEndDate.value = state.tripEndDate || visibleTripRange.end || visibleTripRange.start || state.tripDate;
  els.settlementCurrency.value = state.settlementCurrency;
  els.jpyRate.value = state.rates.JPY;
  els.usdRate.value = state.rates.USD;
  els.thbRate.value = state.rates.THB;
  els.vndRate.value = state.rates.VND;
  els.cnyRate.value = state.rates.CNY;
  els.eurRate.value = state.rates.EUR;
  els.accountBank.value = state.account.bank;
  els.accountNumber.value = state.account.number;
  els.accountHolder.value = state.account.holder;
  renderTripList();
  renderPeople();
  renderPayers();
  renderExpenses();
  renderResults();
  saveState();
}

function renderHeader() {
  els.appTitle.textContent = state.tripName || "정산";
  els.appSubtitle.textContent = `${tripPeriodLabel()} · ${state.people.join(" · ")}`;
  els.appSubtitle.title = "클릭해서 일정을 수정";
}

function renderTripList() {
  const current = state.id;
  els.tripSelect.replaceChildren();
  appState.trips
    .slice()
    .sort((a, b) => b.tripDate.localeCompare(a.tripDate))
    .forEach((trip) => {
      const option = document.createElement("option");
      option.value = trip.id;
      option.textContent = `${trip.tripName} · ${tripPeriodLabel(trip)} · ${trip.expenses.length}건`;
      els.tripSelect.append(option);
    });
  els.tripSelect.value = current;
}

function renderPeople() {
  els.peopleCount.textContent = `${state.people.length}명`;
  els.peopleList.replaceChildren();
  state.people.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = `${name} 삭제`;
    remove.addEventListener("click", () => removePerson(name));
    chip.append(remove);
    els.peopleList.append(chip);
  });
}

function renderPayers() {
  const current = els.expensePayer.value || state.people[0];
  els.expensePayer.replaceChildren();
  state.people.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.expensePayer.append(option);
  });
  els.expensePayer.value = state.people.includes(current) ? current : state.people[0];
}

function pruneSelectedExpenses() {
  const valid = new Set(state.expenses.map((expense) => expense.id));
  [...uiState.selectedExpenseIds].forEach((id) => {
    if (!valid.has(id)) uiState.selectedExpenseIds.delete(id);
  });
}

function renderBulkControls() {
  if (!els.bulkPanel) return;
  pruneSelectedExpenses();
  const selectedCount = uiState.selectedExpenseIds.size;
  const hasExpenses = state.expenses.length > 0;
  els.bulkToggleButton.hidden = !hasExpenses;
  els.bulkToggleButton.textContent = uiState.bulkPanelOpen ? "일괄 수정 닫기" : "일괄 수정";
  els.bulkToggleButton.setAttribute("aria-expanded", uiState.bulkPanelOpen ? "true" : "false");
  els.bulkPanel.hidden = !hasExpenses || !uiState.bulkPanelOpen;
  els.bulkSelectionCount.textContent = selectedCount ? `${selectedCount}건 선택됨` : "0건 선택";
  els.applyBulkButton.disabled = selectedCount === 0;
  els.bulkPanel.classList.toggle("has-selection", selectedCount > 0);

  const payerValue = els.bulkPayer.value;
  els.bulkPayer.replaceChildren(new Option("결제자 유지", ""));
  state.people.forEach((person) => els.bulkPayer.append(new Option(`${person} 결제`, person)));
  els.bulkPayer.value = state.people.includes(payerValue) ? payerValue : "";

  const splitPersonValue = els.bulkSplitPerson.value || state.people[0];
  els.bulkSplitPerson.replaceChildren();
  state.people.forEach((person) => els.bulkSplitPerson.append(new Option(`${person} 부담`, person)));
  els.bulkSplitPerson.value = state.people.includes(splitPersonValue) ? splitPersonValue : state.people[0];

  renderBulkShareInputs();
  updateBulkModeVisibility();
}

function renderBulkShareInputs() {
  if (!els.bulkShareInputs) return;
  const previous = Object.fromEntries([...els.bulkShareInputs.querySelectorAll(".bulk-share-input")]
    .map((input) => [input.dataset.person, input.value]));
  els.bulkShareInputs.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = "직접 비율";
  els.bulkShareInputs.append(title);
  state.people.forEach((person) => {
    const label = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = person;
    const input = document.createElement("input");
    input.className = "bulk-share-input";
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "0.5";
    input.value = previous[person] ?? "1";
    input.dataset.person = person;
    label.append(name, input);
    els.bulkShareInputs.append(label);
  });
}

function updateBulkModeVisibility() {
  if (!els.bulkPanel) return;
  const mode = els.bulkSplitMode.value;
  els.bulkSplitPerson.hidden = mode !== "single";
  els.bulkShareInputs.hidden = mode !== "custom";
}

function renderExpenses() {
  els.expenseList.replaceChildren();
  renderExpenseSummary();
  renderBulkControls();
  if (!state.expenses.length) {
    els.expenseList.innerHTML = '<p class="empty-state">아직 정산할 내역이 없습니다.</p>';
    return;
  }

  const template = document.querySelector("#expenseRowTemplate");
  getSortedExpenses().forEach((expense) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const money = formatExpenseMoneyParts(expense);
    const included = expense.included !== false;
    const category = categoryLabel(expense.category);
    const editing = uiState.editingExpenseId === expense.id;
    const main = row.querySelector(".expense-main");
    const editButton = row.querySelector(".edit-expense");
    row.classList.toggle("needs-review", expense.review);
    row.classList.toggle("is-foreign", expense.currency !== state.settlementCurrency);
    row.classList.toggle("is-excluded", !included);
    row.classList.toggle("is-editing", editing);
    row.classList.toggle("is-selected", uiState.selectedExpenseIds.has(expense.id));
    row.style.setProperty("--date-color", dateColor(expense.date));
    row.querySelector(".expense-day").textContent = formatShortDate(expense.date);
    const selectButton = row.querySelector(".select-expense");
    selectButton.textContent = uiState.selectedExpenseIds.has(expense.id) ? "선택됨" : "선택";
    selectButton.title = uiState.selectedExpenseIds.has(expense.id) ? "일괄 변경 선택 해제" : "일괄 변경 선택";
    selectButton.setAttribute("aria-pressed", uiState.selectedExpenseIds.has(expense.id) ? "true" : "false");
    selectButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExpenseSelection(expense.id);
    });

    if (editing) {
      main.replaceChildren(createExpenseEditor(expense, category));
      main.addEventListener("click", (event) => event.stopPropagation());
      editButton.textContent = "저장";
      editButton.title = "수정 저장";
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        saveExpenseEdit(expense.id, row);
      });
    } else {
      row.querySelector(".expense-title").textContent = expense.title;
      row.querySelector(".expense-subline").textContent = formatLongDate(expense.date);
      row.querySelector(".expense-category").textContent = category;
      row.querySelector(".expense-category").hidden = !category;
      row.querySelector(".expense-payer").textContent = `${expense.payer} 결제`;
      row.querySelector(".expense-split").textContent = included
        ? `${splitLabel(expense)}${expense.review ? " · 확인 필요" : ""}`
        : "정산 제외";
      main.addEventListener("click", () => startExpenseEdit(expense.id));
      editButton.textContent = "수정";
      editButton.title = "결제 내용 수정";
      editButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startExpenseEdit(expense.id);
      });
    }

    row.querySelector(".expense-money").textContent = money.original;
    row.querySelector(".expense-converted").textContent = money.converted;
    const includeButton = row.querySelector(".include-toggle");
    includeButton.textContent = included ? "✓" : "";
    includeButton.classList.toggle("is-excluded", !included);
    includeButton.title = included ? "정산 총액에 반영 중" : "정산 총액에서 제외됨";
    includeButton.setAttribute("aria-label", included ? "정산 총액에서 제외" : "정산 총액에 포함");
    includeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleExpenseIncluded(expense.id);
    });
    row.querySelector(".delete-expense").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteExpense(expense.id);
    });
    els.expenseList.append(row);
  });
}

function renderExpenseSummary() {
  if (!els.expenseSummary) return;
  if (uiState.expenseSortKey === "category") uiState.expenseSortKey = "date";
  if (els.expenseSortKey) els.expenseSortKey.value = uiState.expenseSortKey;
  if (els.expenseSortDirection) {
    els.expenseSortDirection.textContent = uiState.expenseSortDirection === "desc" ? "↓" : "↑";
    els.expenseSortDirection.title = uiState.expenseSortDirection === "desc" ? "큰 값/최근순" : "작은 값/오래된순";
  }

  if (!state.expenses.length) {
    els.expenseSummary.textContent = "0건";
    return;
  }

  const dates = state.expenses.map((expense) => expense.date).filter(Boolean).sort();
  const sortLabel = {
    date: "결제일",
    amount: "금액",
    title: "내용",
  }[uiState.expenseSortKey] || "결제일";
  const range = dates.length ? `${formatShortDate(dates[0])} - ${formatShortDate(dates[dates.length - 1])}` : "날짜 없음";
  els.expenseSummary.textContent = `${state.expenses.length}건 · ${range} · ${sortLabel} ${uiState.expenseSortDirection === "desc" ? "내림차순" : "오름차순"}`;
}

function getSortedExpenses() {
  const direction = uiState.expenseSortDirection === "asc" ? 1 : -1;
  return state.expenses.slice().sort((a, b) => {
    const primary = compareExpenseValue(a, b, uiState.expenseSortKey);
    if (primary !== 0) return primary * direction;
    return compareExpenseValue(a, b, "date") * -1 || a.title.localeCompare(b.title, "ko-KR");
  });
}

function compareExpenseValue(a, b, key) {
  if (key === "amount") return toSettlementAmount(a) - toSettlementAmount(b);
  if (key === "title") return a.title.localeCompare(b.title, "ko-KR");
  if (key === "category") return a.category.localeCompare(b.category, "ko-KR");
  return expenseTimestamp(a).localeCompare(expenseTimestamp(b));
}

function renderResults() {
  const { total, balances, paid, owed, settlements } = calculate();
  els.totalSpend.textContent = formatMoney(total);
  els.perPerson.textContent = formatSettlementMoney(total / Math.max(state.people.length, 1));
  els.settlementCount.textContent = `${settlements.length}건`;
  els.settlementSummary.textContent = settlements.length ? `${settlements.length}번 송금` : "송금 없음";
  renderPaymentTable({ total, balances, paid, owed });
  renderAccount();

  els.balanceList.replaceChildren();
  Object.entries(balances).forEach(([name, amount]) => {
    const row = document.createElement("article");
    row.className = "balance-row";
    const signClass = amount >= 0 ? "amount-positive" : "amount-negative";
    row.innerHTML = `<div><strong>${name}</strong><span>결제액과 부담액 기준</span></div><div class="${signClass}">${formatSettlementMoney(amount)}</div>`;
    els.balanceList.append(row);
  });

  els.settlementList.replaceChildren();
  if (!settlements.length) {
    els.settlementList.innerHTML = '<p class="empty-state">이미 깔끔하게 맞아 있습니다.</p>';
    return;
  }
  settlements.forEach((item) => {
    const row = document.createElement("article");
    row.className = "settlement-row";
    row.innerHTML = `<div><strong>${item.from} → ${item.to}</strong><span>공유 링크에서 그대로 확인</span></div><div class="amount-negative">${formatSettlementMoney(item.amount)}</div>`;
    els.settlementList.append(row);
  });
}

function renderPaymentTable({ total, balances, paid, owed }) {
  els.reportTripName.textContent = state.tripName || "정산";
  els.reportSubtitle.textContent = `${tripPeriodLabel()} · ${state.people.join(" · ")}`;
  els.reportSubtitle.title = "클릭해서 일정을 수정";
  els.paymentTable.replaceChildren();

  const header = document.createElement("div");
  header.className = "payment-row payment-head";
  ["이름", "결제", "부담", "정산"].forEach((label) => {
    const cellEl = document.createElement("span");
    cellEl.textContent = label;
    header.append(cellEl);
  });
  els.paymentTable.append(header);

  state.people.forEach((name) => {
    const balance = balances[name] || 0;
    const row = document.createElement("div");
    row.className = `payment-row ${balance > 0 ? "is-creditor" : ""}`;
    const status = settlementStatus(balance);
    [name, formatMoney(paid[name] || 0), formatSettlementMoney(owed[name] || 0), status].forEach((value, index) => {
      const cellEl = document.createElement(index === 0 ? "strong" : "span");
      cellEl.textContent = value;
      if (index === 3) cellEl.className = balance > 0 ? "amount-positive" : balance < 0 ? "amount-negative" : "";
      row.append(cellEl);
    });
    els.paymentTable.append(row);
  });

  const totalRow = document.createElement("div");
  totalRow.className = "payment-total";
  totalRow.innerHTML = `<strong>합계</strong><strong>${formatMoney(total)}</strong>`;
  els.paymentTable.append(totalRow);
}

function renderAccount() {
  const line = accountText();
  els.accountLine.textContent = line || "정산 탭에서 계좌를 입력하세요";
}

function settlementStatus(balance) {
  if (balance > 0) return `받을 금액 ${formatSettlementMoney(balance)}`;
  if (balance < 0) return `보낼 금액 ${formatSettlementMoney(Math.abs(balance))}`;
  return "정산 완료";
}

function accountText() {
  return [state.account.bank, state.account.number, state.account.holder].filter(Boolean).join(" ");
}

function addPerson() {
  const name = els.personInput.value.trim();
  if (isRecentImeEchoName(name)) {
    els.personInput.value = "";
    return;
  }
  if (!name || state.people.includes(name)) return;
  state.people.push(name);
  lastPersonAdd = { name, time: Date.now() };
  state.expenses = state.expenses.map((expense) => normalizeExpense({
    ...expense,
    participants: expense.shares ? expense.participants : [...new Set([...(expense.participants || []), name])],
  }));
  els.personInput.value = "";
  render();
}

function isRecentImeEchoName(name) {
  const recentEnough = Date.now() - lastPersonAdd.time < 900;
  const recentEcho = name && recentEnough && lastPersonAdd.name.endsWith(name) && lastPersonAdd.name !== name;
  const danglingFinalChar = name.length === 1 && state.people.some((person) => person.length > 1 && person.endsWith(name));
  return Boolean(recentEcho || danglingFinalChar);
}

function removePerson(name) {
  if (state.people.length <= 1) return;
  state.people = state.people.filter((person) => person !== name);
  state.expenses = state.expenses.map((expense) => normalizeExpense({
    ...expense,
    payer: expense.payer === name ? state.people[0] : expense.payer,
    participants: expense.participants.filter((person) => person !== name),
    shares: normalizeShares(expense.shares, state.people),
  }));
  render();
}

function categoryLabel(category) {
  const value = String(category || "").replace(/^여행\s*\/\s*/i, "").trim();
  return value && value !== "여행" ? value : "";
}

function normalizeCategoryInput(value) {
  const category = String(value || "").trim();
  if (!category) return "여행";
  return category.startsWith("여행 /") ? category : `여행 / ${category}`;
}

function createExpenseEditor(expense, category) {
  const editor = document.createElement("div");
  editor.className = "expense-editor";

  const titleInput = document.createElement("input");
  titleInput.className = "expense-edit-title";
  titleInput.type = "text";
  titleInput.value = expense.title;
  titleInput.placeholder = "결제 내용";

  const categoryInput = document.createElement("input");
  categoryInput.className = "expense-edit-category";
  categoryInput.type = "text";
  categoryInput.value = category;
  categoryInput.placeholder = "태그 예: 식비, 교통비";

  const dateInput = document.createElement("input");
  dateInput.className = "expense-edit-date";
  dateInput.type = "date";
  dateInput.value = expense.date;

  const amountInput = document.createElement("input");
  amountInput.className = "expense-edit-amount";
  amountInput.type = "number";
  amountInput.inputMode = "decimal";
  amountInput.min = "0";
  amountInput.step = ["USD", "EUR", "CNY", "THB"].includes(expense.currency) ? "0.01" : "1";
  amountInput.value = expense.amount;
  amountInput.placeholder = "원금";

  const currencySelect = document.createElement("select");
  currencySelect.className = "expense-edit-currency";
  currencySelect.setAttribute("aria-label", "결제 통화");
  CURRENCIES.forEach((currency) => {
    const option = document.createElement("option");
    option.value = currency;
    option.textContent = currency;
    currencySelect.append(option);
  });
  currencySelect.value = expense.currency;

  const convertedInput = document.createElement("input");
  convertedInput.className = "expense-edit-converted";
  convertedInput.type = "number";
  convertedInput.inputMode = "numeric";
  convertedInput.min = "0";
  convertedInput.step = "1";
  convertedInput.value = expense.currency === "KRW"
    ? ""
    : Math.round(Number(expense.convertedAmountKrw) > 0 ? Number(expense.convertedAmountKrw) : Number(expense.amount) * rateOf(expense.currency));
  convertedInput.placeholder = "원화 환산액";

  const payerSelect = document.createElement("select");
  payerSelect.className = "expense-edit-payer";
  payerSelect.setAttribute("aria-label", "결제자");
  state.people.forEach((person) => {
    const option = document.createElement("option");
    option.value = person;
    option.textContent = `${person} 결제`;
    payerSelect.append(option);
  });
  payerSelect.value = state.people.includes(expense.payer) ? expense.payer : state.people[0];

  const shareBox = document.createElement("div");
  shareBox.className = "expense-share-editor";
  const shareTitle = document.createElement("strong");
  shareTitle.textContent = "부담 비율";
  shareBox.append(shareTitle);
  const currentShares = expenseShareInputValues(expense);
  state.people.forEach((person) => {
    const label = document.createElement("label");
    const name = document.createElement("span");
    name.textContent = person;
    const input = document.createElement("input");
    input.className = "expense-share-input";
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "0.5";
    input.value = currentShares[person] || 0;
    input.dataset.person = person;
    label.append(name, input);
    shareBox.append(label);
  });

  [titleInput, categoryInput, dateInput, amountInput, convertedInput].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveExpenseEdit(expense.id, editor.closest(".expense-row"));
      if (event.key === "Escape") {
        uiState.editingExpenseId = "";
        renderExpenses();
      }
    });
  });

  editor.append(titleInput, categoryInput, dateInput, amountInput, currencySelect, convertedInput, payerSelect, shareBox);
  return editor;
}

function startExpenseEdit(id) {
  uiState.editingExpenseId = id;
  renderExpenses();
}

function saveExpenseEdit(id, row) {
  const titleInput = row?.querySelector(".expense-edit-title");
  const categoryInput = row?.querySelector(".expense-edit-category");
  const dateInput = row?.querySelector(".expense-edit-date");
  const amountInput = row?.querySelector(".expense-edit-amount");
  const currencySelect = row?.querySelector(".expense-edit-currency");
  const convertedInput = row?.querySelector(".expense-edit-converted");
  const payerSelect = row?.querySelector(".expense-edit-payer");
  if (!titleInput || !categoryInput || !dateInput || !amountInput || !currencySelect || !convertedInput || !payerSelect) return;

  const currency = CURRENCIES.includes(currencySelect.value) ? currencySelect.value : "KRW";
  const amount = Number(amountInput.value) || 0;
  const convertedAmountKrw = currency === "KRW" ? null : Number(convertedInput.value) || null;
  const shares = Object.fromEntries([...row.querySelectorAll(".expense-share-input")]
    .map((input) => [input.dataset.person, Number(input.value) || 0])
    .filter(([name, value]) => state.people.includes(name) && value > 0));
  const participants = Object.keys(shares).length ? Object.keys(shares) : [...state.people];
  state.expenses = state.expenses.map((item) => item.id === id
    ? normalizeExpense({
      ...item,
      title: titleInput.value.trim() || item.title,
      amount,
      currency,
      convertedAmountKrw,
      payer: payerSelect.value,
      category: normalizeCategoryInput(categoryInput.value),
      date: normalizeDateInput(dateInput.value) || item.date,
      participants,
      shares: Object.keys(shares).length ? shares : null,
    })
    : item);
  uiState.editingExpenseId = "";
  render();
}

function toggleExpenseIncluded(id) {
  state.expenses = state.expenses.map((expense) => expense.id === id
    ? normalizeExpense({ ...expense, included: expense.included === false })
    : expense);
  render();
}

function toggleExpenseSelection(id) {
  if (uiState.selectedExpenseIds.has(id)) uiState.selectedExpenseIds.delete(id);
  else {
    uiState.selectedExpenseIds.add(id);
    uiState.bulkPanelOpen = true;
  }
  uiState.editingExpenseId = "";
  renderExpenses();
}

function selectAllExpenses() {
  getSortedExpenses().forEach((expense) => uiState.selectedExpenseIds.add(expense.id));
  uiState.bulkPanelOpen = true;
  uiState.editingExpenseId = "";
  renderExpenses();
}

function clearExpenseSelection() {
  uiState.selectedExpenseIds.clear();
  renderExpenses();
}

function bulkShareValues() {
  return Object.fromEntries([...els.bulkShareInputs.querySelectorAll(".bulk-share-input")]
    .map((input) => [input.dataset.person, Number(input.value) || 0])
    .filter(([name, value]) => state.people.includes(name) && value > 0));
}

function applyBulkChanges() {
  pruneSelectedExpenses();
  if (!uiState.selectedExpenseIds.size) return;
  const ids = new Set(uiState.selectedExpenseIds);
  const category = els.bulkCategory.value.trim();
  const payer = els.bulkPayer.value;
  const splitMode = els.bulkSplitMode.value;
  const singlePerson = els.bulkSplitPerson.value;
  const customShares = bulkShareValues();

  state.expenses = state.expenses.map((expense) => {
    if (!ids.has(expense.id)) return expense;
    const patch = { ...expense };
    if (category) patch.category = normalizeCategoryInput(category);
    if (payer && state.people.includes(payer)) patch.payer = payer;
    if (splitMode === "equal") {
      patch.participants = [...state.people];
      patch.shares = null;
    }
    if (splitMode === "single" && state.people.includes(singlePerson)) {
      patch.participants = [singlePerson];
      patch.shares = { [singlePerson]: 1 };
    }
    if (splitMode === "custom" && Object.keys(customShares).length) {
      patch.participants = Object.keys(customShares);
      patch.shares = customShares;
    }
    return normalizeExpense(patch);
  });

  els.bulkCategory.value = "";
  uiState.editingExpenseId = "";
  uiState.selectedExpenseIds.clear();
  uiState.bulkPanelOpen = false;
  render();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter((item) => item.id !== id);
  uiState.selectedExpenseIds.delete(id);
  render();
}

function addExpense(expense) {
  state.expenses.unshift(normalizeExpense(expense));
  render();
}

function importExpenses(expenses) {
  const existing = new Set(state.expenses.map((item) => `${item.title}-${item.amount}-${item.currency}-${item.date}`));
  let added = 0;
  expenses.forEach((expense) => {
    const normalized = normalizeExpense(expense);
    const key = `${normalized.title}-${normalized.amount}-${normalized.currency}-${normalized.date}`;
    if (!existing.has(key)) {
      state.expenses.unshift(normalized);
      existing.add(key);
      added += 1;
    }
  });
  render();
  return added;
}

function uniqueExpenses(expenses) {
  const seen = new Set();
  return expenses.filter((expense) => {
    const key = `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLedgerText(text) {
  const cardStatement = parseCardStatementText(text);
  if (cardStatement.length) return cardStatement;

  const structured = parseStructuredLedgerText(text);
  if (structured.length) return structured;

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const fromBlocks = parseLedgerBlocks(lines);
  const recoveredKrw = [
    ...recoverKrwBlockAmounts(lines, fromBlocks),
    ...recoverKrwRegexBlocks(text, fromBlocks),
  ];
  if (fromBlocks.length || recoveredKrw.length) return mergeParsedExpenses([...fromBlocks, ...recoveredKrw]);

  const parsed = [];

  lines.forEach((line, index) => {
    if (isUiOrExampleLine(line)) return;
    if (/(예:|placeholder)/i.test(`${lines[index - 1] || ""} ${lines[index - 2] || ""}`)) return;
    const amountMatch = findAmount(line);
    if (!amountMatch || isLikelyDailyTotal(line, amountMatch)) return;

    const titleLine = findTextTitle(lines, index, amountMatch.raw);
    const title = cleanTitle(titleLine || "가계부 가져오기");
    const context = lines.slice(Math.max(0, index - 4), index + 5).join(" ");
    if (isUiOrExampleLine(title)) return;
    if (amountMatch.currency === "KRW" && !isTravelText(`${title} ${context}`)) return;

    parsed.push({
      title,
      amount: amountMatch.amount,
      currency: amountMatch.currency,
      date: inferDate(lines, index) || state.tripDate,
      payer: state.people[0],
      category: guessCategory(`${title} ${context}`),
      participants: [...state.people],
      review: isWeakTitle(title),
    });
  });

  return parsed;
}

function parseCardStatementText(text) {
  const lines = cardStatementLines(text);
  return mergeParsedExpenses([
    ...parseKbCardLines(lines),
    ...parseSequentialCardLines(lines),
  ]);
}

function parseKbCardText(text) {
  return parseKbCardLines(cardStatementLines(text));
}

function cardStatementLines(text) {
  return String(text || "")
    .split(/\r?\n+/)
    .map((line) => cleanMarkdownLine(line.trim()))
    .filter(Boolean);
}

function parseKbCardLines(lines) {
  if (!lines.some((line) => /HERITAGE|KB\s*Pay|전표매입|전표미매입|일시불/i.test(line))) return [];

  const parsed = [];
  let currentDate = "";
  let pendingTitle = "";
  let pendingAmount = null;
  let pendingTime = "";

  const flush = () => {
    if (!pendingTitle || !pendingAmount || !currentDate) return;
    parsed.push({
      title: cleanKbMerchant(pendingTitle),
      amount: pendingAmount.amount,
      currency: pendingAmount.currency,
      date: currentDate,
      time: pendingTime,
      payer: state.people[0],
      category: guessCategory(pendingTitle),
      participants: [...state.people],
    });
    pendingTitle = "";
    pendingAmount = null;
    pendingTime = "";
  };

  lines.forEach((line) => {
    const date = parseKbDateHeader(line);
    if (date) {
      flush();
      currentDate = date;
      return;
    }
    if (!currentDate || isKbMetaLine(line)) return;

    const amountMatch = findAmount(line);
    if (amountMatch) {
      pendingAmount = amountMatch;
      return;
    }

    const time = line.match(/^(\d{1,2}):(\d{2})$/);
    if (time) {
      pendingTime = `${time[1].padStart(2, "0")}:${time[2]}`;
      flush();
      return;
    }

    if (isKbMerchantLine(line)) {
      flush();
      pendingTitle = line;
    }
  });
  flush();

  return mergeParsedExpenses(parsed);
}

function parseSequentialCardLines(lines) {
  const parsed = [];
  for (let index = 0; index < lines.length - 2; index += 1) {
    const title = lines[index];
    const amountMatch = findAmount(lines[index + 1]);
    const moment = parseLedgerMoment(lines[index + 2]);
    if (!amountMatch || !moment.date || !isCardMerchantTitle(title)) continue;

    parsed.push({
      title: cleanCardMerchant(title),
      amount: amountMatch.amount,
      currency: amountMatch.currency,
      date: moment.date,
      time: moment.time,
      payer: state.people[0],
      category: guessCategory(title),
      participants: [...state.people],
    });
    index += 2;
  }
  return mergeParsedExpenses(parsed);
}

function cleanMarkdownLine(line) {
  return String(line || "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKbDateHeader(line) {
  const match = String(line || "").match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (!match) return "";
  const baseYear = Number((state.tripDate || new Date().toISOString()).slice(0, 4)) || new Date().getFullYear();
  return dateParts(baseYear, match[1], match[2]).date;
}

function isKbMetaLine(line) {
  return /^(KB\s*Pay|일시불|전표매입|전표미매입|HERITAGE|국내|해외|승인|취소)/i.test(String(line || ""));
}

function isKbMerchantLine(line) {
  const text = String(line || "").trim();
  if (!text || findAmount(text) || /^(\d{1,2}):(\d{2})$/.test(text) || isKbMetaLine(text)) return false;
  return /[가-힣A-Za-z0-9]/.test(text);
}

function cleanKbMerchant(title) {
  return cleanCardMerchant(title);
}

function isCardMerchantTitle(line) {
  const text = String(line || "").trim();
  if (!text || findAmount(text) || parseLedgerMoment(text).date || isKbMetaLine(text)) return false;
  return /[가-힣A-Za-z0-9]/.test(text);
}

function cleanCardMerchant(title) {
  return cleanTitle(String(title || "").replace(/\bKB\s*Pay\b/gi, "").replace(/^[_\-\s]+/, "").trim());
}

function parseStructuredLedgerText(text) {
  const rows = parseDelimitedRows(text);
  return parseStructuredRows(rows);
}

function parseDelimitedRows(text) {
  const rawLines = String(text || "").split(/\r?\n/).filter((line) => line.trim());
  if (!rawLines.length) return [];
  const delimiter = rawLines[0].includes("\t") ? "\t" : rawLines[0].includes(",") ? "," : "";
  if (!delimiter) return [];
  return rawLines.map((line) => splitDelimitedLine(line, delimiter));
}

function splitDelimitedLine(line, delimiter) {
  if (delimiter === "\t") return line.split("\t").map((cell) => cell.trim());
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseStructuredRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalizeHeader(cell) === "날짜") && row.some((cell) => normalizeHeader(cell) === "내용"));
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map(normalizeHeader);
  const column = (name) => headers.indexOf(normalizeHeader(name));
  const idx = {
    date: column("날짜"),
    category: column("분류"),
    subcategory: column("소분류"),
    title: column("내용"),
    krwAmount: column("금액(원)"),
    flow: column("수입/지출"),
    originalAmount: column("금액"),
    currency: column("화폐"),
  };

  return rows.slice(headerIndex + 1).flatMap((row) => {
    const flow = cell(row, idx.flow);
    const category = cell(row, idx.category);
    const title = cell(row, idx.title);
    if (!title || (flow && flow !== "지출")) return [];
    if (category && !/여행\s*\/\s*공/.test(category)) return [];

    const currency = normalizeCurrency(cell(row, idx.currency));
    const krwAmount = toNumber(cell(row, idx.krwAmount));
    const originalAmount = toNumber(cell(row, idx.originalAmount)) || krwAmount;
    if (!originalAmount) return [];

    const ledgerMoment = parseLedgerMoment(cell(row, idx.date));
    return [{
      title,
      amount: originalAmount,
      currency,
      convertedAmountKrw: krwAmount || (currency === "KRW" ? originalAmount : null),
      date: ledgerMoment.date || state.tripDate,
      time: ledgerMoment.time,
      payer: state.people[0],
      category: cell(row, idx.subcategory) || category || "여행",
      participants: [...state.people],
    }];
  });
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s/g, "").trim();
}

function cell(row, index) {
  return index >= 0 ? String(row[index] ?? "").trim() : "";
}

function normalizeCurrency(value) {
  const raw = String(value || "KRW").trim();
  if (/바트|BAHT|THB|฿/i.test(raw)) return "THB";
  if (/동|VND|₫|DONG/i.test(raw)) return "VND";
  if (/위안|위엔|CNY|RMB|CN¥|元|人民币/i.test(raw)) return "CNY";
  if (/유로|EUR|€/i.test(raw)) return "EUR";
  const currency = raw.toUpperCase();
  return CURRENCIES.includes(currency) ? currency : "KRW";
}

function toNumber(value) {
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLedgerDate(value) {
  return parseLedgerMoment(value).date;
}

function parseLedgerMoment(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateParts(value.getFullYear(), value.getMonth() + 1, value.getDate(), value.getHours(), value.getMinutes());
  }

  const text = String(value || "").trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const excelSerial = Number(text);
    if (Number.isFinite(excelSerial) && excelSerial > 20000) {
      const date = new Date(Date.UTC(1899, 11, 30) + excelSerial * 86400000);
      return dateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
    }
  }

  const yearFirst = text.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})/);
  if (yearFirst) return dateParts(yearFirst[1], yearFirst[2], yearFirst[3], ...timeParts(text));

  const monthFirst = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+|$)/);
  if (monthFirst) {
    const year = Number(monthFirst[3]) < 100 ? 2000 + Number(monthFirst[3]) : Number(monthFirst[3]);
    return dateParts(year, monthFirst[1], monthFirst[2], ...timeParts(text));
  }

  if (/[A-Za-z]{3}/.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return dateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(), parsed.getHours(), parsed.getMinutes());
    }
  }

  return { date: "", time: "" };
}

function timeParts(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  return match ? [match[1], match[2]] : ["", ""];
}

function dateParts(year, month, day, hour = "", minute = "") {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d) return { date: "", time: "" };
  return {
    date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    time: hour === "" || minute === "" ? "" : `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function mergeParsedExpenses(expenses) {
  const seen = new Set();
  return expenses.filter((expense) => {
    const key = `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function recoverKrwBlockAmounts(lines, existing) {
  const existingKeys = new Set(existing.map((expense) => `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`));
  const recovered = [];

  lines.forEach((line, index) => {
    const amountMatch = findAmount(line);
    if (!amountMatch || amountMatch.currency !== "KRW") return;

    const startIndex = findPreviousTransactionStart(lines, index);
    if (startIndex < 0) return;

    const blockLines = lines.slice(startIndex, index + 1);
    const title = findBlockTitle(blockLines);
    if (!title || merchantScore(title) < 20) return;

    const day = findPreviousDay(lines, startIndex);
    const expense = {
      title,
      amount: amountMatch.amount,
      currency: "KRW",
      date: day ? dateWithDay(day) : state.tripDate,
      payer: state.people[0],
      category: guessCategory(blockLines.join(" ")),
      participants: [...state.people],
      review: isWeakTitle(title),
    };
    const key = `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`;
    if (!existingKeys.has(key)) recovered.push(expense);
  });

  return recovered;
}

function recoverKrwRegexBlocks(text, existing) {
  const existingKeys = new Set(existing.map((expense) => `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`));
  const recovered = [];
  const pattern = /(여행\s*\/\s*공[\s\S]{0,280}?)([1-9][\d,]*(?:\.\d+)?\s*원)/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const blockText = match[1];
    const amountMatch = findAmount(match[2]);
    if (!amountMatch || amountMatch.currency !== "KRW") continue;

    const blockLines = blockText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const title = findDirectMerchantTitle(blockLines) || findBlockTitle(blockLines);
    if (!title || merchantScore(title) < 20) continue;

    const beforeBlock = text.slice(0, match.index);
    const dayMatches = [...beforeBlock.matchAll(/(?:^|\n)\s*([0-3]?\d)\s*(?:\n|$)/g)];
    const day = dayMatches.at(-1)?.[1] || "";
    const expense = {
      title,
      amount: amountMatch.amount,
      currency: "KRW",
      date: day ? dateWithDay(day) : state.tripDate,
      payer: state.people[0],
      category: guessCategory(blockText),
      participants: [...state.people],
      review: isWeakTitle(title),
    };
    const key = `${expense.title}-${expense.amount}-${expense.currency}-${expense.date}`;
    if (!existingKeys.has(key)) recovered.push(expense);
  }

  return recovered;
}

function findDirectMerchantTitle(lines) {
  const afterTransactionStart = lines.slice(1).map(cleanTitle).filter(Boolean);
  return afterTransactionStart.find((line) => isTitleCandidate(line) && merchantScore(line) > 0) || "";
}

function extractKrwFallbackExpenses(text) {
  const expenses = [];
  const directPattern = /여행\s*\/\s*공[^\n]*\n+([\s\S]{0,220}?)([1-9][\d,]*(?:\.\d+)?\s*원)/g;
  let directMatch;

  while ((directMatch = directPattern.exec(text)) !== null) {
    if (/(^|\n)\s*0원\s*(\n|$)/.test(directMatch[1])) continue;
    if (/(^|\n)\s*[0-3]?\d\s*(\n|$)/.test(directMatch[1])) continue;
    const titleLine = directMatch[1]
      .split(/\n+/)
      .map((line) => cleanTitle(line.trim()))
      .find((line) => /^KB/.test(line));
    const amount = Number(directMatch[2].replace(/[^\d.]/g, ""));
    if (titleLine && Number.isFinite(amount) && amount > 0) {
      const beforeBlock = text.slice(0, directMatch.index);
      const days = [...beforeBlock.matchAll(/(?:^|\n)\s*([0-3]?\d)\s*(?:\n|$)/g)];
      const day = days.length ? days[days.length - 1][1] : "";
      expenses.push({
        title: titleLine,
        amount,
        currency: "KRW",
        date: day ? dateWithDay(day) : state.tripDate,
        payer: state.people[0],
        category: guessCategory(directMatch[1]),
        participants: [...state.people],
        review: isWeakTitle(titleLine),
      });
    }
  }

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let currentDay = "";
  let active = null;

  lines.forEach((line) => {
    if (isDayMarker(line)) {
      currentDay = line.match(/\b([0-3]?\d)\b/)?.[1] || currentDay;
      active = null;
      return;
    }

    if (isTransactionStart(line)) {
      active = { day: currentDay, title: "", context: [line] };
      return;
    }

    if (!active) return;
    active.context.push(line);

    if (!active.title && (/^KB/.test(line) || (isTitleCandidate(line) && merchantScore(line) > 0))) {
      active.title = cleanTitle(line);
    }

    const amountMatch = findAmount(line);
    if (!amountMatch || amountMatch.currency !== "KRW" || amountMatch.amount <= 0) return;
    if (!active.title) return;

    expenses.push({
      title: active.title,
      amount: amountMatch.amount,
      currency: "KRW",
      date: active.day ? dateWithDay(active.day) : state.tripDate,
      payer: state.people[0],
      category: guessCategory(active.context.join(" ")),
      participants: [...state.people],
      review: isWeakTitle(active.title),
    });
    active = null;
  });

  return expenses;
}

function findPreviousTransactionStart(lines, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isTransactionStart(lines[cursor])) return cursor;
    if (isDayMarker(lines[cursor])) return -1;
  }
  return -1;
}

function findPreviousDay(lines, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (isDayMarker(lines[cursor])) return lines[cursor].match(/\b([0-3]?\d)\b/)?.[1] || "";
  }
  return "";
}

function parseLedgerBlocks(lines) {
  const blocks = [];
  let currentDay = "";
  let pending = null;

  const closePending = () => {
    if (pending?.lines.length) {
      blocks.push(pending);
    }
    pending = null;
  };

  lines.forEach((line, index) => {
    if (isDayMarker(line)) {
      closePending();
      currentDay = line.match(/\b([0-3]?\d)\b/)?.[1] || currentDay;
      return;
    }

    if (isTransactionStart(line)) {
      closePending();
      pending = { day: currentDay, startIndex: index, lines: [line] };
      return;
    }

    if (pending) pending.lines.push(line);
  });
  closePending();

  return blocks.flatMap((block) => {
    const expense = parseTransactionBlock(block);
    return expense ? [expense] : [];
  });
}

function isTransactionStart(line) {
  return /^여행\s*\/\s*공/.test(String(line || "").trim());
}

function parseTransactionBlock(block) {
  const blockLines = block.lines.filter((line) => !isUiOrExampleLine(line));
  const amountLine = blockLines.find((line) => {
    const amount = findAmount(line);
    return Boolean(amount);
  });
  if (!amountLine) return null;

  const amountMatch = findAmount(amountLine);
  const title = findBlockTitle(blockLines);
  if (!title) return null;

  const context = blockLines.join(" ");
  if (amountMatch.currency === "KRW" && !isTravelText(`${title} ${context}`)) return null;

  return {
    title,
    amount: amountMatch.amount,
    currency: amountMatch.currency,
    date: block.day ? dateWithDay(block.day) : state.tripDate,
    payer: state.people[0],
    category: guessCategory(`${title} ${context}`),
    participants: [...state.people],
    review: isWeakTitle(title),
  };
}

function findBlockTitle(lines) {
  const candidates = lines
    .map(cleanTitle)
    .filter(isTitleCandidate)
    .map((title, index) => ({
      title,
      score: merchantScore(title) + (isTravelText(title) ? 18 : 0) - index * 2,
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.title || "";
}

function findTextTitle(lines, index, amountRaw) {
  const sameLine = cleanTitle(lines[index], amountRaw);
  if (isTitleCandidate(sameLine)) return sameLine;

  const offsets = [-1, -2, -3, -4, 1, 2, 3, 4];
  const candidates = offsets
    .map((offset) => lines[index + offset])
    .filter(Boolean)
    .map(cleanTitle)
    .filter(isTitleCandidate)
    .map((title, rank) => ({
      title,
      score: merchantScore(title) + (isTravelText(title) ? 18 : 0) - rank * 5,
    }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.title || "";
}

function findAmount(line) {
  const patterns = [
    { currency: "JPY", regex: /(JP\s*[¥Y·・•.*\-]?|JPY|JPX|JPN|¥|엔)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "JPY", regex: /([\d,]+(?:\.\d+)?)\s*(JPY|엔)/i, amountIndex: 1 },
    { currency: "USD", regex: /(US\$|USD|\$|달러)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "USD", regex: /([\d,]+(?:\.\d+)?)\s*(USD|달러)/i, amountIndex: 1 },
    { currency: "THB", regex: /(THB|฿|바트)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "THB", regex: /([\d,]+(?:\.\d+)?)\s*(THB|바트|฿)/i, amountIndex: 1 },
    { currency: "VND", regex: /(VND|₫|동)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "VND", regex: /([\d,]+(?:\.\d+)?)\s*(VND|동|₫)/i, amountIndex: 1 },
    { currency: "CNY", regex: /(CNY|RMB|CN¥|위안|위엔|元|人民币)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "CNY", regex: /([\d,]+(?:\.\d+)?)\s*(CNY|RMB|CN¥|위안|위엔|元|人民币)/i, amountIndex: 1 },
    { currency: "EUR", regex: /(EUR|€|유로)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "EUR", regex: /([\d,]+(?:\.\d+)?)\s*(EUR|€|유로)/i, amountIndex: 1 },
    { currency: "KRW", regex: /(KRW|₩)\s*([\d,]+(?:\.\d+)?)/i, amountIndex: 2 },
    { currency: "KRW", regex: /([\d,]+(?:\.\d+)?)\s*(원|KRW|₩)/i, amountIndex: 1 },
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (!match) continue;
    const numeric = match[pattern.amountIndex];
    const amount = Number(String(numeric).replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      return { currency: pattern.currency, amount, raw: match[0] };
    }
  }
  return null;
}

function cleanTitle(text, amountRaw = "") {
  return String(text || "")
    .replace(amountRaw, "")
    .replace(/오전|오후|\d{1,2}:\d{2}/g, "")
    .replace(/[💳✈️💰|]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function isTitleCandidate(text) {
  const candidate = cleanTitle(text);
  if (!candidate) return false;
  if (findAmount(candidate)) return false;
  if (isUiOrExampleLine(candidate)) return false;
  if (/^(여비교통비|예비교통비|집대비|밴드지출|국내지급수수료|개인용|차량유지비|소모품비)$/.test(candidate)) return false;
  if (/^여행\s*\/|^오전|^오후|대한항공|헤리티지|허리티지|국민행복|더모아|레버카드/i.test(candidate)) return false;
  if (/^(0원|월요일|화요일|수요일|목요일|금요일|토요일|일요일|\d{1,2}|×|\+)$/.test(candidate)) return false;
  if (/^(오전|오후|\d{1,2}[:.])/.test(candidate)) return false;
  return /[가-힣A-Za-z]/.test(candidate);
}

function isWeakTitle(title) {
  return title.length < 4 || /가계부|대한항공|헤리티지|허리티지|여비교통비/.test(title);
}

function merchantScore(text) {
  const value = String(text || "");
  let score = 0;
  if (/KB(일본|한국)|일본|한국공항|Klook|클룩|네이버페이|제주항공|호텔|HOTEL|SUSHIRO|KINSHIYO|MATSUSHI|MATSUCHI|KAMUKURA|TAKASHIM|FAMILY|HANKYU|HANKYUKU|MARUCHIM|DONQUIJO|LUCUA|공항공사/i.test(value)) score += 65;
  if (/[A-Z]{4,}/.test(value)) score += 14;
  if (/여비교통비|예비교통비|집대비|차량유지비|소모품비|대한항공|헤리티지|허리티지|오전|오후/.test(value)) score -= 75;
  if (/^여행\s*\//.test(value)) score -= 80;
  return score;
}

function isLikelyDailyTotal(line, amountMatch) {
  const withoutAmount = cleanTitle(line, amountMatch.raw);
  return amountMatch.currency === "KRW" && (
    !/[가-힣A-Za-z]/.test(withoutAmount) ||
    /^\d{1,2}/.test(withoutAmount) ||
    withoutAmount === "0원" ||
    withoutAmount.length < 2
  );
}

function isUiOrExampleLine(text) {
  return /(TRAVEL SPLIT|SETTLE UP|여행 정산 링크|정산 링크|공유 링크|총 지출|1인 예상|정산 건수|참가자|텍스트 분석|비우기|파일 선택|예:|placeholder|복사|정산표|이름 추가|내역|가져오기|정산|통화)/i.test(String(text || ""));
}

function isTravelText(text) {
  return /(여행|항공|오사카|일본|한국공항|제주항공|klook|클룩|하루카|티켓|이심|보험|교통|호텔|숙소|택시|공항|라멘|마트|family|hotel|sushiro|kinshiyo|matsushi|matsuchi|kamukura|takashim|hankyu|hankyuku|maruchim|donquijo|lucua)/i.test(text);
}

function inferDate(lines, index) {
  for (let offset = 0; offset <= 14; offset += 1) {
    const dayLine = lines[index - offset];
    if (isDayMarker(dayLine)) {
      const day = dayLine.match(/\b([0-3]?\d)\b/)?.[1];
      if (day) return dateWithDay(day);
    }
  }
  for (let offset = 1; offset <= 3; offset += 1) {
    const dayLine = lines[index + offset];
    if (isDayMarker(dayLine)) {
      const day = dayLine.match(/\b([0-3]?\d)\b/)?.[1];
      if (day) return dateWithDay(day);
    }
  }
  return "";
}

function isDayMarker(text) {
  const value = String(text || "").trim();
  if (findAmount(value) || /[:.]/.test(value)) return false;
  return /^([0-3]?\d)(\s|$)/.test(value) && (value.length <= 8 || /월|화|수|목|금|토|일/.test(value));
}

function dateWithDay(day) {
  const base = state.tripDate ? new Date(`${state.tripDate}T00:00:00`) : new Date();
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function guessCategory(text) {
  if (/항공|제주항공|티켓|하루카|교통|공항|택시|familyma|family|열차|버스/i.test(text)) return "여행 / 교통";
  if (/보험/i.test(text)) return "여행 / 보험";
  if (/이심|esim|통신/i.test(text)) return "여행 / 통신";
  if (/호텔|숙소|hotel/i.test(text)) return "여행 / 숙박";
  if (/라멘|마트|sushiro|식당|카페|kinshiyo|matsushi|matsuchi|kamukura/i.test(text)) return "여행 / 식비";
  return "여행";
}

function setToday() {
  els.expenseDate.value = state.tripDate || new Date().toISOString().slice(0, 10);
}

function createNewTrip() {
  const trip = createTrip(nextTripName(), []);
  appState.trips.push(trip);
  setActiveTrip(trip.id);
  els.shareBox.hidden = true;
  resetImportPanel("새 정산을 만들었습니다. 엑셀 파일을 올리거나 카드사 내역을 붙여넣으세요.");
  render();
}

function duplicateTrip() {
  const trip = normalizeTrip({
    ...state,
    id: uid("trip"),
    tripName: `${state.tripName} 복사본`,
    expenses: state.expenses.map((expense) => ({ ...expense, id: uid("expense") })),
  });
  appState.trips.push(trip);
  setActiveTrip(trip.id);
  resetImportPanel("복제된 정산으로 전환했습니다.");
  render();
}

function deleteCurrentTrip() {
  if (appState.trips.length <= 1) {
    state.expenses = [];
    render();
    els.importHint.textContent = "마지막 정산이라 내역만 비웠습니다.";
    return;
  }
  appState.trips = appState.trips.filter((trip) => trip.id !== state.id);
  setActiveTrip(appState.trips[0].id);
  resetImportPanel("정산을 삭제하고 다른 정산으로 전환했습니다.");
  render();
}

function clearCurrentTrip() {
  state.expenses = [];
  resetImportPanel("현재 정산의 내역을 모두 삭제했습니다.");
  render();
  els.importHint.textContent = "현재 정산의 내역을 모두 삭제했습니다.";
}

async function runLedgerFileImport() {
  const file = els.ledgerFileInput.files?.[0];
  if (!file) return;

  els.importHint.textContent = "엑셀/CSV 파일을 읽는 중입니다.";
  const extension = file.name.split(".").pop()?.toLowerCase();

  try {
    let rows = [];
    if (extension === "xlsx") {
      rows = await readXlsxFileInBrowser(file);
    } else if (extension === "csv" || extension === "tsv") {
      const text = await file.text();
      rows = parseDelimitedRows(text);
    } else {
      throw new Error("unsupported file format");
    }

    els.ledgerText.value = rowsToTsv(rows);
    const parsed = parseStructuredRows(rows);
    const added = importExpenses(parsed);
    els.importHint.textContent = added ? `${file.name}에서 ${added}건을 추가했습니다.` : `${file.name}에서 정산 후보를 찾지 못했습니다.`;
  } catch (clientError) {
    if (location.protocol === "file:") {
      els.importHint.textContent = ".xlsx를 바로 읽으려면 인터넷 연결이 필요합니다. CSV/TSV로 저장하거나 엑셀 내용을 복사해 붙여넣을 수도 있습니다.";
      console.error(clientError);
      return;
    }

    await runServerLedgerFileImport(file);
  }
}

async function readXlsxFileInBrowser(file) {
  if (!window.XLSX) {
    throw new Error("XLSX browser parser is not loaded");
  }
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dateNF: "yyyy. mm. dd hh:mm:ss",
    raw: false,
  });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  return window.XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    header: 1,
    raw: false,
    dateNF: "yyyy. mm. dd hh:mm:ss",
    defval: "",
  });
}

function rowsToTsv(rows) {
  return rows.map((row) => row.map((cellValue) => String(cellValue ?? "")).join("\t")).join("\n");
}

async function runServerLedgerFileImport(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/import-ledger", { method: "POST", body: formData });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    els.ledgerText.value = data.text || "";
    const parsed = parseStructuredRows(data.rows || []);
    const added = importExpenses(parsed);
    els.importHint.textContent = added ? `${file.name}에서 ${added}건을 추가했습니다.` : `${file.name}에서 정산 후보를 찾지 못했습니다.`;
  } catch (error) {
    els.importHint.textContent = "파일을 읽지 못했습니다. .xlsx, .csv, .tsv 형식인지 확인하세요.";
    console.error(error);
  }
}

function updateAccount() {
  state.account = normalizeAccount({
    bank: els.accountBank.value.trim(),
    number: els.accountNumber.value.trim(),
    holder: els.accountHolder.value.trim(),
  });
  renderAccount();
  saveState();
}

async function copyAccount() {
  const text = accountText();
  if (!text) {
    els.copyAccountButton.textContent = "계좌를 먼저 입력하세요";
    setTimeout(() => {
      els.copyAccountButton.textContent = "계좌번호 복사하기";
    }, 1600);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    els.copyAccountButton.textContent = "복사되었습니다";
  } catch {
    els.copyAccountButton.textContent = "계좌를 선택해 복사하세요";
  }
  setTimeout(() => {
    els.copyAccountButton.textContent = "계좌번호 복사하기";
  }, 1600);
}

function exportDataFile() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${safeFileName(state.tripName)}-travel-splitter.json`);
}

async function importDataFile() {
  const file = els.dataFileInput.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    appState.trips = Array.isArray(parsed.trips) ? parsed.trips.map(normalizeTrip) : [];
    appState.activeTripId = parsed.activeTripId || appState.trips[0]?.id || "";
    if (!appState.trips.length) throw new Error("empty backup");
    setActiveTrip(appState.activeTripId);
    els.shareBox.hidden = true;
    resetImportPanel("기록 파일을 불러왔습니다.");
    render();
  } catch (error) {
    alert("기록 파일을 불러오지 못했습니다.");
    console.error(error);
  } finally {
    els.dataFileInput.value = "";
  }
}

function exportSettlementImage() {
  const { total, balances, paid, owed } = calculate();
  const expenses = getSortedExpenses();
  const width = 1080;
  const rowHeight = 88;
  const expenseRowHeight = 86;
  const headerTop = 150;
  const startY = 298;
  const settlementCardHeight = 230 + state.people.length * rowHeight;
  const accountY = headerTop + settlementCardHeight + 48;
  const expenseTitleY = accountY + 150;
  const expenseStartY = expenseTitleY + 46;
  const footerY = expenseStartY + Math.max(expenses.length, 1) * expenseRowHeight + 36;
  const height = footerY + 80;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = "#f5f7f8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#17202a";
  drawText(ctx, state.tripName || "정산", 64, 78, 44, 950);
  drawText(ctx, `${tripPeriodLabel()} · ${state.people.join(" · ")}`, 64, 116, 24, 700, "#65717d");

  roundRect(ctx, 52, headerTop, width - 104, settlementCardHeight, 24, "#ffffff", "#2f6df6", 4);
  drawText(ctx, "💸 각자 낼 돈", 96, 214, 30, 900);
  drawText(ctx, `총 지출 ${formatMoney(total)} · ${state.people.length}명`, 96, 250, 22, 700, "#65717d");

  ["이름", "결제", "부담", "정산"].forEach((label, index) => {
    drawText(ctx, label, [96, 350, 565, 790][index], startY, 20, 800, "#65717d");
  });
  state.people.forEach((name, index) => {
    const y = startY + 42 + index * rowHeight;
    const balance = balances[name] || 0;
    if (balance > 0) roundRect(ctx, 82, y - 35, width - 164, 68, 0, "#e8f8f1");
    drawText(ctx, name, 96, y, 27, 900);
    drawText(ctx, formatMoney(paid[name] || 0), 350, y, 23, 850);
    drawText(ctx, formatSettlementMoney(owed[name] || 0), 565, y, 23, 850);
    drawText(ctx, settlementStatus(balance), 740, y, 22, 900, balance > 0 ? "#0f8a61" : balance < 0 ? "#e3343f" : "#65717d");
  });

  drawText(ctx, "🏦 보내실 곳", 96, accountY, 24, 850, "#65717d");
  roundRect(ctx, 96, accountY + 26, width - 192, 72, 14, "#f4f7ff", "#c9d8ff", 2);
  drawText(ctx, accountText() || "정산 탭에서 계좌를 입력하세요", 126, accountY + 72, 30, 900);

  drawText(ctx, "🧾 결제 내역", 96, expenseTitleY, 30, 900);
  drawText(ctx, `${expenses.length}건 · ${tripPeriodLabel()}`, 292, expenseTitleY, 20, 700, "#65717d");
  if (!expenses.length) {
    roundRect(ctx, 96, expenseStartY - 26, width - 192, 56, 12, "#ffffff", "#dce3e8", 1);
    drawText(ctx, "아직 결제 내역이 없습니다.", 124, expenseStartY + 9, 22, 750, "#65717d");
  } else {
    expenses.forEach((expense, index) => {
      const y = expenseStartY + index * expenseRowHeight;
      const included = expense.included !== false;
      const category = categoryLabel(expense.category);
      const detail = [`${expense.payer} 결제`, splitLabel(expense), category, included ? "" : "정산 제외"].filter(Boolean).join(" · ");
      roundRect(ctx, 96, y - 28, width - 192, 68, 12, included ? "#ffffff" : "#f8fafb", "#dce3e8", 1);
      roundRect(ctx, 124, y - 12, 62, 28, 8, dateColor(expense.date));
      drawText(ctx, formatShortDate(expense.date), 136, y + 8, 18, 900, "#ffffff");
      drawText(ctx, truncateText(ctx, expense.title, 510), 208, y - 2, 25, 900, included ? "#17202a" : "#9aa5af");
      drawText(ctx, detail, 208, y + 27, 17, 700, included ? "#65717d" : "#9aa5af");
      const money = formatExpenseMoneyParts(expense);
      if (money.converted) {
        drawRightText(ctx, money.original, 944, y - 4, 22, 900, included ? "#2f6df6" : "#9aa5af");
        drawRightText(ctx, money.converted, 944, y + 26, 19, 900, included ? "#0f8a61" : "#9aa5af");
      } else {
        drawRightText(ctx, money.original, 944, y + 8, 22, 900, included ? "#17202a" : "#9aa5af");
      }
    });
  }

  drawText(ctx, "정산 링크를 보내면 같은 기록을 볼 수 있습니다.", 96, footerY, 20, 700, "#65717d");

  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `${safeFileName(state.tripName)}-정산표.png`);
  }, "image/png");
}

function drawText(ctx, text, x, y, size, weight = 700, color = "#17202a") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(text, x, y);
}

function drawRightText(ctx, text, rightX, y, size, weight = 700, color = "#17202a") {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(text, rightX - ctx.measureText(text).width, y);
}

function truncateText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let truncated = value;
  while (truncated.length > 1 && ctx.measureText(`${truncated}...`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

function roundRect(ctx, x, y, width, height, radius, fill, stroke = "", lineWidth = 1) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileName(name) {
  return String(name || "travel-splitter").replace(/[\\/:*?"<>|]/g, "-");
}

function bindEvents() {
  els.tripSelect.addEventListener("change", () => {
    setActiveTrip(els.tripSelect.value);
    els.shareBox.hidden = true;
    resetImportPanel("선택한 정산으로 전환했습니다.");
    setToday();
    render();
  });
  els.newTripButton.addEventListener("click", createNewTrip);
  els.duplicateTripButton.addEventListener("click", duplicateTrip);
  els.deleteTripButton.addEventListener("click", deleteCurrentTrip);
  els.clearAllButton.addEventListener("click", clearCurrentTrip);
  els.tripName.addEventListener("input", () => {
    state.tripName = els.tripName.value.trim() || "정산";
    renderHeader();
    renderPaymentTable(calculate());
    renderTripList();
    saveState();
  });
  els.tripDate.addEventListener("change", () => {
    state.tripDate = els.tripDate.value || state.tripDate;
    renderTripList();
    setToday();
    saveState();
  });
  [els.tripStartDate, els.tripEndDate].forEach((input) => {
    input.addEventListener("change", () => {
      state.tripStartDate = normalizeDateInput(els.tripStartDate.value);
      state.tripEndDate = normalizeDateInput(els.tripEndDate.value);
      state.tripDate = state.tripStartDate || state.tripDate;
      renderHeader();
      renderPaymentTable(calculate());
      renderTripList();
      setToday();
      saveState();
    });
  });
  [els.appSubtitle, els.reportSubtitle].forEach((target) => {
    target.addEventListener("click", () => {
      els.tripStartDate.scrollIntoView({ behavior: "smooth", block: "center" });
      els.tripStartDate.focus();
    });
  });
  els.settlementCurrency.addEventListener("change", () => {
    state.settlementCurrency = els.settlementCurrency.value;
    render();
  });
  [els.jpyRate, els.usdRate, els.thbRate, els.vndRate, els.cnyRate, els.eurRate].forEach((input) => {
    input.addEventListener("input", () => {
      state.rates.JPY = Number(els.jpyRate.value) || state.rates.JPY;
      state.rates.USD = Number(els.usdRate.value) || state.rates.USD;
      state.rates.THB = Number(els.thbRate.value) || state.rates.THB;
      state.rates.VND = Number(els.vndRate.value) || state.rates.VND;
      state.rates.CNY = Number(els.cnyRate.value) || state.rates.CNY;
      state.rates.EUR = Number(els.eurRate.value) || state.rates.EUR;
      renderExpenses();
      renderResults();
      saveState();
    });
  });
  [els.accountBank, els.accountNumber, els.accountHolder].forEach((input) => {
    input.addEventListener("input", updateAccount);
  });
  els.copyAccountButton.addEventListener("click", copyAccount);
  els.exportImageButton.addEventListener("click", exportSettlementImage);
  els.exportDataButton.addEventListener("click", exportDataFile);
  els.dataFileInput.addEventListener("change", importDataFile);
  els.addPersonButton.addEventListener("click", addPerson);
  els.personInput.addEventListener("compositionstart", () => {
    personInputComposing = true;
  });
  els.personInput.addEventListener("compositionend", () => {
    personInputComposing = false;
  });
  els.personInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.isComposing || personInputComposing || event.keyCode === 229) return;
    addPerson();
  });
  els.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addExpense({
      title: els.expenseTitle.value.trim(),
      amount: Number(els.expenseAmount.value),
      currency: els.expenseCurrency.value,
      date: els.expenseDate.value,
      payer: els.expensePayer.value,
      category: "여행",
      participants: [...state.people],
    });
    els.expenseForm.reset();
    els.expenseCurrency.value = state.settlementCurrency;
    setToday();
    renderPayers();
  });
  els.expenseSortKey.addEventListener("change", () => {
    uiState.expenseSortKey = els.expenseSortKey.value;
    renderExpenses();
  });
  els.expenseSortDirection.addEventListener("click", () => {
    uiState.expenseSortDirection = uiState.expenseSortDirection === "desc" ? "asc" : "desc";
    renderExpenses();
  });
  els.bulkToggleButton.addEventListener("click", () => {
    uiState.bulkPanelOpen = !uiState.bulkPanelOpen;
    renderBulkControls();
  });
  els.selectAllExpensesButton.addEventListener("click", selectAllExpenses);
  els.clearExpenseSelectionButton.addEventListener("click", clearExpenseSelection);
  els.bulkSplitMode.addEventListener("change", updateBulkModeVisibility);
  els.applyBulkButton.addEventListener("click", applyBulkChanges);
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab, .tab-page").forEach((item) => item.classList.remove("is-active"));
      tab.classList.add("is-active");
      document.querySelector(`#${tab.dataset.tab}Page`).classList.add("is-active");
      document.querySelector(".app-shell").dataset.activeTab = tab.dataset.tab;
    });
  });
  els.shareButton.addEventListener("click", () => {
    const baseUrl = location.origin === "null" ? location.href.split("#")[0] : `${location.origin}${location.pathname}`;
    const url = `${baseUrl}#share=${encodeShare()}`;
    els.shareUrl.value = url;
    els.shareBox.hidden = false;
    els.shareStatus.textContent = "이 링크를 보내야 현재 입력한 정산 기록까지 같이 보입니다.";
  });
  els.copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.shareUrl.value);
      els.shareStatus.textContent = "복사되었습니다.";
    } catch {
      els.shareUrl.select();
      els.shareStatus.textContent = "선택된 링크를 복사하세요.";
    }
  });
  els.resetButton.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
    location.hash = "";
    appState.trips = [createInitialTrip()];
    appState.activeTripId = appState.trips[0].id;
    setActiveTrip(appState.activeTripId);
    resetImportPanel("전체 상태를 초기화했습니다.");
    render();
  });
  els.ledgerFileInput.addEventListener("change", runLedgerFileImport);
  els.parseTextButton.addEventListener("click", () => {
    const baseParsed = parseLedgerText(els.ledgerText.value);
    const krwFallback = extractKrwFallbackExpenses(els.ledgerText.value);
    const parsed = mergeParsedExpenses([...baseParsed, ...krwFallback]);
    const added = importExpenses(parsed);
    const reviewCount = parsed.filter((item) => item.review).length;
    els.importHint.textContent = added ? `${added}건을 분석해 추가했습니다.${reviewCount ? ` ${reviewCount}건은 확인 필요입니다.` : ""}` : "정산 후보를 찾지 못했습니다.";
  });
  els.clearTextButton.addEventListener("click", () => {
    els.ledgerText.value = "";
  });
}

loadState();
bindEvents();
setToday();
els.expenseCurrency.value = state.settlementCurrency;
render();
