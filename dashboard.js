"use strict";

// The broker dashboard is for admins (1), workers (2), and broker-linked
// clients (3). A broker sees only their own broker (enforced by the server).
const role = getRole();
const isBroker = role === "3" && !!getBrokerId();
if (!getToken() || (role !== "1" && role !== "2" && !isBroker)) {
  clearSession();
  window.location.replace("index.html");
}

// A broker only ever has one broker, so hide the search box and relabel.
function applyBrokerMode() {
  const search = document.getElementById("BrokerSearch");
  if (search) search.style.display = isBroker ? "none" : "";
  const heading = document.querySelector(".sidebar h2");
  if (heading) heading.textContent = isBroker ? t("nav.myBroker") : t("nav.brokers");
}
applyBrokerMode();

const BrokerList = document.getElementById("BrokerList");
const BrokerSearch = document.getElementById("BrokerSearch");
const UserName = document.getElementById("UserName");
const LogoutBtn = document.getElementById("LogoutBtn");
const EmptyState = document.getElementById("EmptyState");
const Detail = document.getElementById("Detail");
const DetailName = document.getElementById("DetailName");
const StatBalance = document.getElementById("StatBalance");
const StatInactive = document.getElementById("StatInactive");
const StatPolicies = document.getElementById("StatPolicies");
const PeriodRows = document.getElementById("PeriodRows");
const TotalPolicies = document.getElementById("TotalPolicies");
const TotalMovement = document.getElementById("TotalMovement");
const PoliciesBtn = document.getElementById("PoliciesBtn");
const PaymentBanner = document.getElementById("PaymentBanner");
const PoliciesPanel = document.getElementById("PoliciesPanel");
const PoliciesRows = document.getElementById("PoliciesRows");
const PoliciesSince = document.getElementById("PoliciesSince");
const InactivePoliciesBtn = document.getElementById("InactivePoliciesBtn");
const InactivePoliciesPanel = document.getElementById("InactivePoliciesPanel");
const InactivePoliciesRows = document.getElementById("InactivePoliciesRows");
const InactivePoliciesCount = document.getElementById("InactivePoliciesCount");
const PoliciesFrom = document.getElementById("PoliciesFrom");
const PoliciesTo = document.getElementById("PoliciesTo");
const PoliciesDateClear = document.getElementById("PoliciesDateClear");
const PoliciesExportBtn = document.getElementById("PoliciesExportBtn");
const PoliciesTotalBalance = document.getElementById("PoliciesTotalBalance");
const PoliciesBreakdown = document.getElementById("PoliciesBreakdown");
const PoliciesPager = document.getElementById("PoliciesPager");
const PoliciesPrevBtn = document.getElementById("PoliciesPrevBtn");
const PoliciesNextBtn = document.getElementById("PoliciesNextBtn");
const PoliciesPageLabel = document.getElementById("PoliciesPageLabel");
const Report = document.getElementById("Report");
const ReportFrom = document.getElementById("ReportFrom");
const ReportTo = document.getElementById("ReportTo");
const ReportBrokerBalance = document.getElementById("ReportBrokerBalance");
const ReportKapAndreevoCash = document.getElementById("ReportKapAndreevoCash");
const ReportKapAndreevoCard = document.getElementById("ReportKapAndreevoCard");
const ReportLesovoCash = document.getElementById("ReportLesovoCash");
const ReportLesovoCard = document.getElementById("ReportLesovoCard");
const ReportExpenses = document.getElementById("ReportExpenses");
const ReportTotal = document.getElementById("ReportTotal");
const ReportNetTotal = document.getElementById("ReportNetTotal");
const ReportMsg = document.getElementById("ReportMsg");
const CashInflowGrid = document.getElementById("CashInflowGrid");
const CashInflowMsg = document.getElementById("CashInflowMsg");

// The report is a company-wide aggregate, so broker accounts never see it.
// Hide immediately (before any async load) to avoid a flash of empty report.
if (Report && isBroker) Report.classList.add("hidden");

UserName.textContent = getUsername();
LogoutBtn.addEventListener("click", () => {
  clearSession();
  window.location.replace("index.html");
});

let brokers = [];
let selectedId = null;
let schedule = null;
let policiesHidePricing = false;

function isPricingHidden(b) {
  if (!b) return false;
  if (b.hidePricing !== undefined) return Boolean(b.hidePricing);
  const isSub = Boolean(b.IsSubBroker || b.isSubBroker);
  const hasParent =
    b.ParentBrokerId !== null &&
    b.ParentBrokerId !== undefined &&
    Number(b.ParentBrokerId) > 0;
  const configured = Boolean(b.PricingConfigured ?? b.pricingConfigured);
  return isSub && !(hasParent && configured);
}

function renderBrokerList() {
  const q = BrokerSearch.value.trim().toLowerCase();
  const items = brokers.filter((b) =>
    String(b.Name || "").toLowerCase().includes(q)
  );

  BrokerList.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "broker-item muted";
    li.textContent = brokers.length ? t("list.noMatches") : t("list.noBrokers");
    BrokerList.appendChild(li);
    return;
  }

  for (const b of items) {
    const li = document.createElement("li");
    li.className = "broker-item" + (b.id === selectedId ? " active" : "");
    li.dataset.id = b.id;

    const name = document.createElement("span");
    name.className = "broker-name";
    name.textContent = b.Name;

    const sub = document.createElement("span");
    sub.className = "broker-sub";
    sub.textContent = isPricingHidden(b)
      ? t("list.inactive", { n: b.InactivePolicies ?? 0 })
      : formatMoney(b.CashBalance) +
        " · " +
        t("list.inactive", { n: b.InactivePolicies ?? 0 });

    li.appendChild(name);
    li.appendChild(sub);
    li.addEventListener("click", () => selectBroker(b.id));
    BrokerList.appendChild(li);
  }
}

function renderBanner(b) {
  if (!PaymentBanner) return;
  if (!schedule || isPricingHidden(b)) {
    PaymentBanner.hidden = true;
    return;
  }
  const balance = Number(b.CashBalance || 0);
  const money = formatMoney(balance);

  let message = "";
  let variant = "";
  let cutoffLabel = "";

  if (b.cutOff) {
    variant = "danger";
    message = t("banner.cutOff", { balance: money });
  } else if (balance < 0) {
    variant = "warn";
    message = t("banner.negative", {
      balance: money,
      windowEnd: formatDate(schedule.windowEnd),
      cutoff: formatDate(schedule.cutoff),
    });
  } else {
    variant = "info";
    message = t("banner.info", {
      range: formatDateRangeHuman(schedule.windowStart, schedule.windowEnd),
    });
    cutoffLabel = schedule.cutoff
      ? t("banner.cutoffLabel", { date: formatDateLong(schedule.cutoff) })
      : "";
  }

  PaymentBanner.className = "banner " + variant;
  PaymentBanner.innerHTML = "";

  const line = document.createElement("div");
  line.className = "banner-line";
  line.textContent = message;
  PaymentBanner.appendChild(line);

  if (cutoffLabel) {
    const cutoff = document.createElement("div");
    cutoff.className = "banner-cutoff";
    cutoff.textContent = cutoffLabel;
    cutoff.setAttribute("data-tooltip", t("banner.cutoffHint"));
    cutoff.setAttribute("tabindex", "0");
    PaymentBanner.appendChild(cutoff);
  }

  PaymentBanner.hidden = false;
}

let policiesData = [];
let policySort = { key: "created", dir: -1 };
// Date range of the policies panel, as "YYYY-MM-DD" strings.
// `policiesDefaultFrom` is the last payment date (start of the current payment
// period). An empty `to` means "up to today".
let policiesDefaultFrom = "";
let policiesRange = { from: "", to: "" };
// Bumped on every policies request so a slow, outdated response is ignored.
let policiesRequestId = 0;
// The policies table is paged in the browser: the whole date range is loaded
// (so the total and the Excel export cover all of it) and shown a page at a time.
const POLICIES_PAGE_SIZE = 24;
let policiesPage = 1;

// Local calendar day as "YYYY-MM-DD" (built from local components, so the day
// never shifts around midnight).
function localDateString(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// --- Payment report (company-wide totals) ------------------------------------

// Read a number from a set of candidate field names on an object. Returns
// `undefined` when no usable value is found, so callers can chain fallbacks.
function pickPaymentValue(data, keys) {
  if (!data) return undefined;
  for (const key of keys) {
    const v = data[key];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

// Accept both a flat shape ({ kapAndreevoCash, kapAndreevoCard, ... }) and a
// nested shape ({ kapAndreevo: { cash, card }, lesovo: { cash, card } }).
function normalizePayments(data) {
  data = data || {};
  const kap = data.kapAndreevo || data.KapAndreevo || {};
  const les = data.lesovo || data.Lesovo || {};
  return {
    kapAndreevoCash:
      pickPaymentValue(data, ["kapAndreevoCash", "KapAndreevoCash", "cashKapAndreevo"]) ??
      pickPaymentValue(kap, ["cash"]) ??
      0,
    kapAndreevoCard:
      pickPaymentValue(data, ["kapAndreevoCard", "KapAndreevoCard", "cardKapAndreevo"]) ??
      pickPaymentValue(kap, ["card"]) ??
      0,
    lesovoCash:
      pickPaymentValue(data, ["lesovoCash", "LesovoCash", "cashLesovo"]) ??
      pickPaymentValue(les, ["cash"]) ??
      0,
    lesovoCard:
      pickPaymentValue(data, ["lesovoCard", "LesovoCard", "cardLesovo"]) ??
      pickPaymentValue(les, ["card"]) ??
      0,
    // Company expenses for the period (money paid out, not collected). The
    // server may return it flat or as { expenses: { total } }.
    expenses:
      pickPaymentValue(data, [
        "expenses",
        "Expenses",
        "totalExpenses",
        "TotalExpenses",
        "expense",
        "Expense",
      ]) ??
      pickPaymentValue(data.expenses || data.Expenses, ["total", "Total", "amount", "Amount"]) ??
      0,
  };
}

// Default range = the current biweekly payment window; fall back to the last
// two weeks when no schedule is available yet.
function defaultReportRange() {
  const start = schedule && schedule.windowStart ? toDate(schedule.windowStart) : null;
  const end = schedule && schedule.windowEnd ? toDate(schedule.windowEnd) : null;
  if (start && end) return { from: localDateString(start), to: localDateString(end) };
  const e = new Date();
  const s = new Date();
  s.setDate(e.getDate() - 13);
  return { from: localDateString(s), to: localDateString(e) };
}

async function loadReport() {
  if (!Report) return;

  // Company-wide aggregate — only meaningful for admins/workers.
  if (isBroker) {
    Report.classList.add("hidden");
    return;
  }
  Report.classList.remove("hidden");

  if (!ReportFrom.value || !ReportTo.value) {
    const r = defaultReportRange();
    if (!ReportFrom.value) ReportFrom.value = r.from;
    if (!ReportTo.value) ReportTo.value = r.to;
  }

  const from = ReportFrom.value.trim();
  const to = ReportTo.value.trim();
  const qs = [];
  if (from) qs.push("from=" + encodeURIComponent(from));
  if (to) qs.push("to=" + encodeURIComponent(to));

  let payments = {
    kapAndreevoCash: 0,
    kapAndreevoCard: 0,
    lesovoCash: 0,
    lesovoCard: 0,
    expenses: 0,
  };

  let brokerBalance = 0;
  ReportMsg.textContent = "";
  ReportMsg.className = "msg report-msg";
  try {
    const data = await api(
      "/reports/payments" + (qs.length ? "?" + qs.join("&") : "")
    );
    payments = normalizePayments(data);
    brokerBalance = pickPaymentValue(data, ["brokerBalance", "BrokerBalance"]) ?? 0;
  } catch (err) {
    ReportMsg.textContent = err.message || t("report.loadFailed");
    ReportMsg.className = "msg report-msg error";
  }

  ReportBrokerBalance.textContent = formatMoney(brokerBalance);
  ReportKapAndreevoCash.textContent = formatMoney(payments.kapAndreevoCash);
  ReportKapAndreevoCard.textContent = formatMoney(payments.kapAndreevoCard);
  ReportLesovoCash.textContent = formatMoney(payments.lesovoCash);
  ReportLesovoCard.textContent = formatMoney(payments.lesovoCard);

  // Expenses are money paid out, so they are shown as a negative amount: the
  // five money cells then add up to the grand total exactly, and the grand
  // total plus the (negative) expenses gives the total after expenses.
  const expenses = Math.abs(Number(payments.expenses) || 0);
  ReportExpenses.textContent = formatMoney(-expenses);

  const total =
    brokerBalance +
    payments.kapAndreevoCash +
    payments.kapAndreevoCard +
    payments.lesovoCash +
    payments.lesovoCard;
  ReportTotal.textContent = formatMoney(total);
  ReportNetTotal.textContent = formatMoney(total - expenses);
}

// --- Cash inflow report (per-broker inflows) ---------------------------------

// Pull a broker name from a set of candidate field names on an entry.
function pickCashInflowName(item) {
  if (!item) return "";
  if (typeof item === "string") return item.trim();
  for (const key of [
    "brokerName",
    "BrokerName",
    "name",
    "Name",
    "broker",
    "Broker",
  ]) {
    const v = item[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

// Accept a bare array, or a wrapper object such as
// { brokers: [...] }, { items: [...] }, { entries: [...] },
// { cashInflow: [...] }, { cashInflows: [...] } or { inflows: [...] }.
function normalizeCashInflow(data) {
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    list =
      data.brokers ||
      data.items ||
      data.entries ||
      data.cashInflow ||
      data.cashInflows ||
      data.inflows ||
      data.data ||
      [];
  }
  if (!Array.isArray(list)) list = [];

  const rows = [];
  for (const item of list) {
    const name = pickCashInflowName(item);
    const cashInflow =
      pickPaymentValue(item, [
        "amount",
        "Amount",
        "cashInflow",
        "CashInflow",
        "inflow",
        "Inflow",
        "paid",
        "Paid",
        "value",
        "Value",
      ]) ?? 0;

    // Owed for the period = the sum of every insurance made by this broker
    // within the requested window. The server reports it under several names.
    const owedForPeriod =
      pickPaymentValue(item, [
        "totalOwed",
        "TotalOwed",
        "owed",
        "Owed",
        "insuranceTotal",
        "InsuranceTotal",
        "insurances",
        "Insurances",
        "policiesTotal",
        "PoliciesTotal",
        "insuranceSum",
        "InsuranceSum",
        "debt",
        "Debt",
      ]) ?? 0;

    // Broker balance right before the period's payment — a signed balance where
    // a negative value means the broker owes money.
    const previousBalance =
      pickPaymentValue(item, [
        "leftover",
        "Leftover",
        "leftoverBalance",
        "LeftoverBalance",
        "previousBalance",
        "PreviousBalance",
        "openingBalance",
        "OpeningBalance",
        "carriedBalance",
        "CarriedBalance",
        "broughtForward",
        "BroughtForward",
        "carryOver",
        "CarryOver",
      ]) ?? 0;

    // Weekly balance is this cycle only: inflow minus owed, excluding any
    // balance carried over from earlier cycles.
    const weeklyBalance = cashInflow - owedForPeriod;

    // Leftover balance = the broker balance right before payment, adjusted by
    // this period's insurances (owed) and payments (inflow). A payment reduces
    // what the broker owes, so a balance of -100 plus a 50 payment leaves -50.
    const leftoverBalance = previousBalance + cashInflow - owedForPeriod;

    // Keep rows that have meaningful data: any owed/balance amount, or a
    // cash inflow of at least €200 (the previous inclusion rule).
    const significant =
      Math.abs(owedForPeriod) >= 1 || Math.abs(previousBalance) >= 1 || cashInflow >= 200;
    if (!significant) continue;

    rows.push({
      name: name || t("report.cashInflow.unknownBroker"),
      cashInflow,
      owedForPeriod,
      weeklyBalance,
      previousBalance,
      leftoverBalance,
    });
  }

  return rows;
}

// Interpolate a heat colour for a weekly balance: red for the most negative
// (brokers who owe the most this period) through to green for the most positive.
function weeklyHeat(value, min, max) {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const hue = Math.round(140 * t); // min -> 0 (red), max -> 140 (green)
  return {
    color: "hsl(" + hue + ", 70%, 45%)",
    tint: "hsla(" + hue + ", 70%, 45%, 0.16)",
  };
}

// Build a single cash-inflow card. `isTotal` marks the all-brokers sum card.
// When `isTotal` is true the four stats become sort controls for the table;
// `sortKey` highlights the active one and `onSort` is called on click.
function buildCashInflowCard(row, isTotal, heat, sortKey, sortDir, onSort) {
  const card = document.createElement("div");
  card.className = "cashinflow-card" + (isTotal ? " cashinflow-total" : "");

  const nameEl = document.createElement("span");
  nameEl.className = "cashinflow-name";
  nameEl.textContent = row.name;

  const stats = document.createElement("div");
  stats.className = "cashinflow-stats";

  // `hint` is the one-line explanation shown in a tooltip on hover/focus.
  // Touch devices have no hover, so the same text is listed in the
  // "What do these numbers mean?" glossary above the cards.
  const addStat = (key, label, value, cls, color, hint) => {
    const item = document.createElement("div");
    item.className = "cashinflow-stat";
    if (hint) item.setAttribute("data-tooltip", hint);

    if (isTotal) {
      item.classList.add("cashinflow-stat-sort");
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      if (key === sortKey) item.classList.add("active");
      const activate = () => onSort && onSort(key);
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    }

    const labelEl = document.createElement("span");
    labelEl.className = "cashinflow-stat-label";
    labelEl.textContent =
      isTotal && key === sortKey ? label + (sortDir === 1 ? " ↑" : " ↓") : label;

    const valueEl = document.createElement("span");
    valueEl.className = "cashinflow-stat-value" + (cls ? " " + cls : "");
    valueEl.textContent = formatMoney(value);
    if (color) valueEl.style.color = color;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    stats.appendChild(item);
  };

  addStat(
    "owedForPeriod",
    t("report.cashInflow.totalOwed"),
    row.owedForPeriod,
    "",
    isTotal ? "var(--accent)" : "",
    t("report.cashInflow.totalOwed.hint")
  );
  addStat(
    "cashInflow",
    t("report.cashInflow.cashInflow"),
    row.cashInflow,
    "cashinflow-inflow",
    "",
    t("report.cashInflow.cashInflow.hint")
  );
  addStat(
    "weeklyBalance",
    t("report.cashInflow.weeklyBalance"),
    row.weeklyBalance,
    row.weeklyBalance > 0 ? "cashinflow-weekly-pos" : "cashinflow-weekly-neg",
    "",
    t("report.cashInflow.weeklyBalance.hint")
  );
  addStat(
    "leftoverBalance",
    t("report.cashInflow.leftover"),
    row.leftoverBalance,
    "cashinflow-leftover",
    "",
    t("report.cashInflow.leftover.hint")
  );

  card.appendChild(nameEl);
  card.appendChild(stats);

  // Colour-code the card itself by this broker's weekly balance.
  if (!isTotal && heat) {
    card.style.borderLeftColor = heat.color;
    card.style.background =
      "linear-gradient(90deg, " + heat.tint + ", transparent 55%)";
  }

  return card;
}

// Current sort key for the cash-inflow table. Defaults to the weekly balance.
let cashInflowSortKey = "weeklyBalance";
// Sort direction: -1 = highest first (descending), 1 = lowest first (ascending).
let cashInflowSortDir = -1;

function renderCashInflow(rows) {
  // Sort a copy by the selected value, falling back to the weekly balance then
  // the amount owed for the period for stable ordering. `cashInflowSortDir`
  // flips between highest first (-1) and lowest first (1).
  const sorted = rows.slice().sort((a, b) => {
    return (
      (Number(b[cashInflowSortKey]) - Number(a[cashInflowSortKey]) ||
        Number(b.weeklyBalance) - Number(a.weeklyBalance) ||
        Number(b.owedForPeriod) - Number(a.owedForPeriod)) *
      cashInflowSortDir
    );
  });

  // Heat range across brokers so the gradient always spans the full weekly
  // balance spread: red for the most negative, green for the most positive.
  let minWeekly = Infinity;
  let maxWeekly = -Infinity;
  for (const row of rows) {
    if (row.weeklyBalance < minWeekly) minWeekly = row.weeklyBalance;
    if (row.weeklyBalance > maxWeekly) maxWeekly = row.weeklyBalance;
  }
  if (!Number.isFinite(minWeekly)) minWeekly = 0;
  if (!Number.isFinite(maxWeekly)) maxWeekly = 0;

  // One combined card summing every broker into an all-brokers total. Its four
  // stats are the clickable sort controls.
  const totals = rows.reduce(
    (acc, row) => {
      acc.owedForPeriod += row.owedForPeriod;
      acc.cashInflow += row.cashInflow;
      acc.weeklyBalance += row.weeklyBalance;
      acc.leftoverBalance += row.leftoverBalance;
      return acc;
    },
    {
      name: t("report.cashInflow.allBrokers"),
      owedForPeriod: 0,
      cashInflow: 0,
      weeklyBalance: 0,
      leftoverBalance: 0,
    }
  );

  CashInflowGrid.innerHTML = "";
  CashInflowGrid.appendChild(
    buildCashInflowCard(
      totals,
      true,
      null,
      cashInflowSortKey,
      cashInflowSortDir,
      (key) => {
        if (cashInflowSortKey === key) {
          cashInflowSortDir *= -1;
        } else {
          cashInflowSortKey = key;
          cashInflowSortDir = -1;
        }
        renderCashInflow(rows);
      }
    )
  );

  for (const row of sorted) {
    CashInflowGrid.appendChild(
      buildCashInflowCard(
        row,
        false,
        weeklyHeat(row.weeklyBalance, minWeekly, maxWeekly)
      )
    );
  }
}

async function loadCashInflow() {
  if (!CashInflowGrid) return;

  // Company-wide aggregate — only meaningful for admins/workers.
  if (isBroker) {
    CashInflowGrid.innerHTML = "";
    CashInflowMsg.textContent = "";
    CashInflowMsg.className = "msg report-msg";
    return;
  }

  if (!ReportFrom.value || !ReportTo.value) {
    const r = defaultReportRange();
    if (!ReportFrom.value) ReportFrom.value = r.from;
    if (!ReportTo.value) ReportTo.value = r.to;
  }

  const from = ReportFrom.value.trim();
  const to = ReportTo.value.trim();
  const qs = [];
  if (from) qs.push("from=" + encodeURIComponent(from));
  if (to) qs.push("to=" + encodeURIComponent(to));

  CashInflowGrid.innerHTML = "";
  CashInflowMsg.textContent = "";
  CashInflowMsg.className = "msg report-msg";

  let rows = [];
  try {
    const data = await api(
      "/reports/cash-inflow" + (qs.length ? "?" + qs.join("&") : "")
    );
    rows = normalizeCashInflow(data);
  } catch (err) {
    CashInflowMsg.textContent = err.message || t("report.cashInflow.loadFailed");
    CashInflowMsg.className = "msg report-msg error";
    return;
  }

  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cashinflow-empty";
    empty.textContent = t("report.cashInflow.empty");
    CashInflowGrid.appendChild(empty);
    return;
  }

  renderCashInflow(rows);
}

ReportFrom.addEventListener("change", loadReport);
ReportTo.addEventListener("change", loadReport);
ReportFrom.addEventListener("change", loadCashInflow);
ReportTo.addEventListener("change", loadCashInflow);

// --- Policies panel date range ------------------------------------------------
//
// The panel defaults to "since the last payment" (the start of the current
// payment period), but the From/To pickers can move the window anywhere, as
// far back as records exist. The server applies the range (?from / ?to).

// Normalise a date-ish value to the "YYYY-MM-DD" form a date input expects.
function dateInputValue(v) {
  const d = toDate(v);
  return d ? localDateString(d) : "";
}

function isDefaultPoliciesRange() {
  return policiesRange.from === policiesDefaultFrom && !policiesRange.to;
}

// The clear button is only useful when the range differs from the default.
function updatePoliciesClearButton() {
  PoliciesDateClear.classList.toggle("hidden", isDefaultPoliciesRange());
}

// Write the active range back into the two date inputs.
function syncPoliciesRangeFields() {
  PoliciesFrom.value = policiesRange.from;
  PoliciesTo.value = policiesRange.to;
  updatePoliciesClearButton();
}

// Back to the default range: from the last payment date up to today.
function resetPoliciesRange() {
  if (!policiesDefaultFrom) {
    policiesDefaultFrom = dateInputValue(schedule && schedule.periodStart);
  }
  policiesRange = { from: policiesDefaultFrom, to: "" };
  policiesPage = 1;
  syncPoliciesRangeFields();
}

// Apply the range typed/picked in the inputs and reload the policies. An empty
// From falls back to the last payment date. The inputs themselves are not
// rewritten here (that would interrupt typing); they are synced on blur.
function applyPoliciesRangeFromInputs() {
  policiesRange = {
    from: PoliciesFrom.value || policiesDefaultFrom,
    to: PoliciesTo.value || "",
  };
  policiesPage = 1;
  updatePoliciesClearButton();
  loadPolicies();
}

// Query string for the policies request. The default range sends no
// parameters, so the server keeps using its own last payment date.
function policiesRangeParams() {
  if (isDefaultPoliciesRange()) return "";
  const qs = [];
  if (policiesRange.from) qs.push("from=" + encodeURIComponent(policiesRange.from));
  if (policiesRange.to) qs.push("to=" + encodeURIComponent(policiesRange.to));
  return qs.length ? "?" + qs.join("&") : "";
}

// Subtitle under the panel title: "Since {date}" or "{from} – {to}".
function renderPoliciesSince() {
  const { from, to } = policiesRange;
  if (!from) {
    PoliciesSince.textContent = "";
  } else if (to) {
    PoliciesSince.textContent = formatDate(from) + " – " + formatDate(to);
  } else {
    PoliciesSince.textContent = t("policies.since", { date: formatDate(from) });
  }
}

function renderPoliciesTotal() {
  if (policiesHidePricing) {
    PoliciesTotalBalance.textContent = "";
    PoliciesTotalBalance.classList.add("hidden");
    return;
  }
  PoliciesTotalBalance.classList.remove("hidden");
  // Annulled policies only contribute their live annulled price (the rest of
  // their price was refunded), so the total matches the sum of the breakdown.
  const total = policiesData.reduce((sum, p) => sum + policyEffectivePrice(p), 0);
  PoliciesTotalBalance.textContent =
    t("policies.totalBalance") + ": " + formatMoney(total);
}

// --- Price breakdown ---------------------------------------------------------
// Group the listed policies by price (and currency) so the panel and the Excel
// export can show how many policies of each price there are, e.g.
// "10× 19 EUR, 20× 30 EUR". Prices are rounded like everywhere else on the
// site (whole amounts only).
//
// Annulled policies are kept out of these groups: their price was refunded, so
// they are listed on their own line under their live annulled price (the
// annulment fee the server keeps — see `policyAnnulledPrice`).
function policyAnnulledPrice(p) {
  if (!p) return 0;
  // `AnnulFee` is the live fee stored with the annulment; the other names are
  // accepted in case the API starts exposing the annulled price by itself.
  for (const key of [
    "AnnulFee", "annulFee", "AnnulPrice", "annulPrice",
    "AnnulledPrice", "annulledPrice",
  ]) {
    const v = p[key];
    if (v === undefined || v === null || String(v).trim() === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  // Older servers do not send the fee at all: fall back to the policy price so
  // the annulled line still shows an amount instead of 0.
  const price = Number(p.Price);
  return Number.isFinite(price) ? price : 0;
}

// The amount a policy still contributes to the totals: a normal policy its
// price, an annulled one only its live annulled price (the rest was refunded).
function policyEffectivePrice(p) {
  if (isPolicyAnnulled(p)) return policyAnnulledPrice(p);
  const price = Number(p && p.Price);
  return Number.isFinite(price) ? price : 0;
}

function groupPoliciesByPrice(policies, priceOf) {
  const groups = new Map();
  for (const p of policies || []) {
    const price = Math.round(priceOf(p));
    const currency = String(p.CurrencyType ?? "").trim();
    const key = price + "|" + currency;
    const group = groups.get(key);
    if (group) {
      group.count += 1;
    } else {
      groups.set(key, { price, currency, count: 1 });
    }
  }
  // Cheapest type first, so the breakdown always reads the same way.
  return Array.from(groups.values()).sort(
    (a, b) => a.price - b.price || a.currency.localeCompare(b.currency)
  );
}

// Active policies only — annulled ones are counted on their own line.
function policyPriceGroups(policies) {
  return groupPoliciesByPrice(
    (policies || []).filter((p) => !isPolicyAnnulled(p)),
    (p) => Number(p.Price || 0)
  );
}

// Annulled policies, grouped by the live annulled price they contribute.
function policyAnnulledGroups(policies) {
  return groupPoliciesByPrice(
    (policies || []).filter((p) => isPolicyAnnulled(p)),
    policyAnnulledPrice
  );
}

// "19 EUR" (the currency is left out when the API does not return one).
function policyPriceLabel(group) {
  return formatMoney(group.price) + (group.currency ? " " + group.currency : "");
}

// One entry per price type: "10× 19 EUR".
function policyPriceGroupItems(groups) {
  return groups.map((group) =>
    t("policies.breakdownItem", {
      count: group.count,
      price: policyPriceLabel(group),
    })
  );
}

function policiesBreakdownItems(policies) {
  return policyPriceGroupItems(policyPriceGroups(policies));
}

// "3× 9 EUR" lines for the annulled policies (their live annulled price).
function policiesAnnulledBreakdownItems(policies) {
  return policyPriceGroupItems(policyAnnulledGroups(policies));
}

// One line inside the breakdown block; the annulled line gets its own class so
// it can be tinted like the annulled table rows.
function policiesBreakdownLine(text, annulled) {
  const line = document.createElement("div");
  if (annulled) line.className = "policies-breakdown-annulled";
  line.textContent = text;
  return line;
}

// "By price: 10× 19 EUR, 20× 30 EUR" under the panel title, followed by
// "Annulled: 2× 9 EUR" for the annulled policies. Hidden while pricing is
// hidden for the broker (the panel shows no prices at all then).
function renderPoliciesBreakdown() {
  const items = policiesHidePricing ? [] : policiesBreakdownItems(policiesData);
  const annulledItems = policiesHidePricing
    ? []
    : policiesAnnulledBreakdownItems(policiesData);
  PoliciesBreakdown.textContent = "";
  if (!items.length && !annulledItems.length) {
    PoliciesBreakdown.classList.add("hidden");
    return;
  }
  if (items.length) {
    PoliciesBreakdown.appendChild(
      policiesBreakdownLine(t("policies.breakdown", { items: items.join(", ") }))
    );
  }
  if (annulledItems.length) {
    PoliciesBreakdown.appendChild(
      policiesBreakdownLine(
        t("policies.breakdownAnnulled", { items: annulledItems.join(", ") }),
        true
      )
    );
  }
  PoliciesBreakdown.classList.remove("hidden");
}

function policySortValue(p) {
  if (policySort.key === "created") {
    const d = toDate(p.CreationDate);
    return d ? d.getTime() : Number.NEGATIVE_INFINITY;
  }
  return policySort.key === "policy" ? p.PolicyNumber : p.BlancNumber;
}

function comparePolicies(a, b) {
  if (policySort.key === "created") {
    return policySortValue(a) - policySortValue(b);
  }
  const av = policySortValue(a);
  const bv = policySortValue(b);
  const na = Number(av);
  const nb = Number(bv);
  if (
    av != null && bv != null && av !== "" && bv !== "" &&
    !Number.isNaN(na) && !Number.isNaN(nb)
  ) {
    return na - nb;
  }
  return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
}

function sortedPolicies() {
  const arr = policiesData.slice();
  arr.sort((a, b) => comparePolicies(a, b) * policySort.dir);
  return arr;
}

// --- Policy field accessors (tolerant of different API field names) ----------

function policyCarNumber(p) {
  if (!p) return "";
  for (const key of [
    "CarNumber", "CarRegNumber", "CarRegistrationNumber",
    "VehicleNumber", "VehicleRegNumber", "VehicleRegistrationNumber",
    "RegistrationNumber", "RegNumber", "Registration",
    "LicensePlate", "PlateNumber", "Plate", "NumberPlate",
    "CarNo", "RegistrationNo", "RegNo", "RegPlate",
  ]) {
    const v = p[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function policyDuration(p) {
  if (!p) return "";
  for (const key of [
    "Duration", "InsuranceDuration", "DurationMonths", "Months",
    "InsuranceMonths", "Period", "InsurancePeriod", "Term",
    "InsuranceTerm", "ValidityMonths", "DurationInMonths",
  ]) {
    const v = p[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
}

function isPolicyAnnulled(p) {
  if (!p) return false;
  for (const key of [
    "IsAnnulled", "isAnnulled", "Annulled", "annulled",
    "IsCanceled", "isCanceled", "IsCancelled", "isCancelled",
    "Canceled", "Cancelled",
  ]) {
    const v = p[key];
    if (v === undefined || v === null || v === "" || v === false) continue;
    const s = String(v).toLowerCase();
    if (s === "false" || s === "0" || s === "no") continue;
    return true;
  }
  const status = String(p.Status ?? p.status ?? "").toLowerCase();
  return (
    status === "annulled" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "annulment" ||
    status === "iptal" ||
    status === "anulirana"
  );
}

function updatePolicySortHeaders() {
  document.querySelectorAll("#PoliciesPanel th[data-sort]").forEach((th) => {
    const active = th.getAttribute("data-sort") === policySort.key;
    th.classList.toggle("sort-asc", active && policySort.dir === 1);
    th.classList.toggle("sort-desc", active && policySort.dir === -1);
    th.setAttribute(
      "aria-sort",
      active ? (policySort.dir === 1 ? "ascending" : "descending") : "none"
    );
  });
}

function renderPolicies(data) {
  const currentBroker = brokers.find((x) => x.id === selectedId);
  policiesHidePricing = Boolean(
    (data && data.hidePricing) ||
      (data && data.broker && isPricingHidden(data.broker)) ||
      isPricingHidden(currentBroker)
  );
  policiesData = data.policies || [];
  // The server is the source of truth for the last payment date. If it differs
  // from what we had (or we had none yet), adopt it; a panel still showing the
  // default range follows the new date.
  const serverDefault = dateInputValue(data.schedule && data.schedule.periodStart);
  if (serverDefault && serverDefault !== policiesDefaultFrom) {
    const wasDefault = isDefaultPoliciesRange();
    policiesDefaultFrom = serverDefault;
    if (wasDefault) {
      policiesRange = { from: serverDefault, to: "" };
      syncPoliciesRangeFields();
    } else {
      updatePoliciesClearButton();
    }
  }
  renderPoliciesSince();
  renderPolicyTable();
}

// Previous / "Page x of y" / Next under the table. Hidden when everything
// fits on one page.
function renderPoliciesPager(totalPages) {
  PoliciesPager.classList.toggle("hidden", totalPages <= 1);
  PoliciesPageLabel.textContent = t("history.pageOf", {
    page: policiesPage,
    total: totalPages,
  });
  PoliciesPrevBtn.disabled = policiesPage <= 1;
  PoliciesNextBtn.disabled = policiesPage >= totalPages;
}

function renderPolicyTable() {
  const priceTh = document.querySelector(
    '#PoliciesPanel th[data-i18n="policies.col.price"]'
  );
  const currTh = document.querySelector(
    '#PoliciesPanel th[data-i18n="policies.col.currency"]'
  );
  if (priceTh) priceTh.classList.toggle("hidden", policiesHidePricing);
  if (currTh) currTh.classList.toggle("hidden", policiesHidePricing);

  PoliciesRows.innerHTML = "";
  const policies = sortedPolicies();
  // Keep the page within bounds (the list may have shrunk since it was set).
  const totalPages = Math.max(1, Math.ceil(policies.length / POLICIES_PAGE_SIZE));
  policiesPage = Math.min(Math.max(1, policiesPage), totalPages);
  const pageStart = (policiesPage - 1) * POLICIES_PAGE_SIZE;
  for (const p of policies.slice(pageStart, pageStart + POLICIES_PAGE_SIZE)) {
    const annulled = isPolicyAnnulled(p);
    const row = document.createElement("tr");
    if (annulled) row.classList.add("annulled");
    // An annulled policy shows its live annulled price (the annulment fee it
    // still contributes) instead of the refunded price; the original price
    // stays available as a tooltip.
    const priceCell = annulled
      ? '<td class="num annulled-price" title="' +
        escapeHtml(t("policies.originalPrice", { price: formatMoney(p.Price) })) +
        '">' +
        formatMoney(policyEffectivePrice(p)) +
        "</td>"
      : '<td class="num">' + formatMoney(p.Price) + "</td>";
    row.innerHTML =
      "<td>" +
      escapeHtml(p.PolicyNumber) +
      (annulled
        ? '<span class="annulled-badge">' +
          escapeHtml(t("policies.annulled")) +
          "</span>"
        : "") +
      "</td>" +
      "<td>" + escapeHtml(p.BlancNumber) + "</td>" +
      (policiesHidePricing
        ? ""
        : priceCell +
          "<td>" +
          escapeHtml(p.CurrencyType) +
          "</td>") +
      "<td>" + escapeHtml(formatDate(p.CreationDate)) + "</td>";
    PoliciesRows.appendChild(row);
  }
  if (policies.length === 0) {
    const emptyMessage = isDefaultPoliciesRange()
      ? t("policies.empty")
      : t("policies.emptyForRange");
    const colSpan = policiesHidePricing ? 3 : 5;
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="' +
      colSpan +
      '" class="policies-empty">' +
      escapeHtml(emptyMessage) +
      "</td>";
    PoliciesRows.appendChild(row);
  }
  updatePolicySortHeaders();
  renderPoliciesTotal();
  renderPoliciesBreakdown();
  renderPoliciesPager(totalPages);
}

document.querySelectorAll("#PoliciesPanel th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.getAttribute("data-sort");
    if (policySort.key === key) {
      policySort.dir *= -1;
    } else {
      policySort.key = key;
      policySort.dir = key === "created" ? -1 : 1;
    }
    policiesPage = 1;
    renderPolicyTable();
  });
});

PoliciesPrevBtn.addEventListener("click", () => {
  policiesPage -= 1;
  renderPolicyTable();
});
PoliciesNextBtn.addEventListener("click", () => {
  policiesPage += 1;
  renderPolicyTable();
});

PoliciesFrom.addEventListener("change", applyPoliciesRangeFromInputs);
PoliciesTo.addEventListener("change", applyPoliciesRangeFromInputs);
// Once editing is finished, show the range actually in effect (e.g. refill an
// emptied From with the last payment date).
PoliciesFrom.addEventListener("blur", syncPoliciesRangeFields);
PoliciesTo.addEventListener("blur", syncPoliciesRangeFields);

PoliciesDateClear.addEventListener("click", () => {
  resetPoliciesRange();
  loadPolicies();
});

// Build an Excel (HTML table) document for a list of policies. Returns the
// full HTML string. `hidePricing` mirrors the on-screen pricing visibility.
function buildPoliciesExcel(policies, hidePricing) {
  const textCell = (v) =>
    '<td style=\'mso-number-format:"@";\'>' + escapeHtml(v) + "</td>";

  const headers = [
    t("policies.col.policy"),
    t("policies.col.blanc"),
    t("policies.col.carNumber"),
    t("policies.col.duration"),
  ];
  if (!hidePricing) {
    headers.push(t("policies.col.price"), t("policies.col.currency"));
  }
  headers.push(t("policies.col.created"), t("policies.col.status"));

  const headerHtml = headers
    .map((h) => '<th style="font-weight:bold;">' + escapeHtml(h) + "</th>")
    .join("");

  const bodyHtml = policies
    .map((p) => {
      const annulled = isPolicyAnnulled(p);
      let cells =
        textCell(p.PolicyNumber) +
        textCell(p.BlancNumber) +
        textCell(policyCarNumber(p)) +
        textCell(policyDuration(p));
      if (!hidePricing) {
        // An annulled policy contributes its live annulled price (the annulment
        // fee); the rest of its price was refunded.
        cells +=
          '<td style=\'mso-number-format:"0";\'>' +
          Math.round(policyEffectivePrice(p)) +
          "</td>" +
          textCell(p.CurrencyType);
      }
      cells +=
        textCell(formatDate(p.CreationDate)) +
        textCell(annulled ? t("policies.annulled") : "");
      return (
        "<tr" +
        (annulled ? ' style="color:#9ca3af;"' : "") +
        ">" +
        cells +
        "</tr>"
      );
    })
    .join("");

  let totalHtml = "";
  if (!hidePricing) {
    const total = policies.reduce((sum, p) => sum + policyEffectivePrice(p), 0);
    totalHtml =
      "<tr style='font-weight:bold;'>" +
      '<td colspan="4">' + escapeHtml(t("policies.totalSum")) + "</td>" +
      '<td style=\'mso-number-format:"0";\'>' + Math.round(total) + "</td>" +
      "<td></td><td></td><td></td>" +
      "</tr>";
  }

  // How many policies of each price there are (e.g. "10× 19 EUR"), listed under
  // the total so the export carries the same summary as the panel. Annulled
  // policies are listed apart, at their live annulled price.
  let breakdownHtml = "";
  const breakdownSections = hidePricing
    ? []
    : [
        {
          title: t("policies.breakdownTitle"),
          items: policiesBreakdownItems(policies),
        },
        {
          title: t("policies.breakdownAnnulledTitle"),
          items: policiesAnnulledBreakdownItems(policies),
        },
      ];
  const colspan = headers.length;
  for (const section of breakdownSections) {
    if (!section.items.length) continue;
    breakdownHtml +=
      '<tr><td colspan="' +
      colspan +
      '" style="font-weight:bold; padding-top:12px;">' +
      escapeHtml(section.title) +
      "</td></tr>" +
      section.items
        .map(
          (item) =>
            '<tr><td colspan="' +
            colspan +
            '" style=\'mso-number-format:"@";\'>' +
            escapeHtml(item) +
            "</td></tr>"
        )
        .join("");
  }

  return (
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
    'xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="UTF-8">' +
    "<!--[if gte mso 9]><xml>" +
    "<x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>" +
    "<x:Name>Policies</x:Name>" +
    "<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>" +
    "</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>" +
    "</xml><![endif]-->" +
    "</head><body><table>" +
    "<tr>" +
    headerHtml +
    "</tr>" +
    bodyHtml +
    totalHtml +
    breakdownHtml +
    "</table></body></html>"
  );
}

function downloadExcel(html, filename) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// File name for the export: the default range keeps the historical name, a
// custom range is named after its dates.
function policiesExportName() {
  if (isDefaultPoliciesRange() || !policiesRange.from) {
    return "policies-since-last-payment.xls";
  }
  return (
    "policies-" +
    policiesRange.from +
    "-to-" +
    (policiesRange.to || localDateString()) +
    ".xls"
  );
}

// Download the currently visible "Policies since last payment" rows as an
// Excel file. Uses Excel's HTML table format so the export works without any
// third-party library, and forces text cells so leading zeros are preserved.
function exportPoliciesExcel() {
  downloadExcel(
    buildPoliciesExcel(sortedPolicies(), policiesHidePricing),
    policiesExportName()
  );
}

PoliciesExportBtn.addEventListener("click", exportPoliciesExcel);

async function selectBroker(id) {
  // Re-selecting the same broker (e.g. after a language change) keeps the
  // chosen policies date range; switching broker resets it to the default.
  const sameBroker = selectedId === id;
  selectedId = id;
  renderBrokerList();

  const b = brokers.find((x) => x.id === id);
  if (!b) return;

  const hidePricing = isPricingHidden(b);
  policiesHidePricing = hidePricing;

  DetailName.textContent = b.Name;
  const statBalanceCard = StatBalance ? StatBalance.closest(".stat") : null;
  if (statBalanceCard) {
    statBalanceCard.classList.toggle("hidden", hidePricing);
  }
  StatBalance.textContent = hidePricing ? "" : formatMoney(b.CashBalance);
  StatInactive.textContent = b.InactivePolicies ?? 0;

  const movTh = document.querySelector(
    '#Detail th[data-i18n="table.balanceMovement"]'
  );
  if (movTh) movTh.classList.toggle("hidden", hidePricing);
  if (TotalMovement) TotalMovement.classList.toggle("hidden", hidePricing);

  const periods = b.periods || [];
  PeriodRows.innerHTML = "";

  let totalPolicies = 0;
  let totalMovement = 0;

  for (const p of periods) {
    totalPolicies += Number(p.policies || 0);
    totalMovement += Number(p.balanceMovement || 0);

    const row = document.createElement("tr");
    row.innerHTML =
      "<td>" + escapeHtml(formatDate(p.start)) + " &ndash; " + escapeHtml(formatDate(p.end)) + "</td>" +
      '<td class="num">' + p.policies + "</td>" +
      (hidePricing
        ? ""
        : '<td class="num ' +
          (Number(p.balanceMovement) < 0 ? "neg" : "pos") +
          '">' +
          formatSignedMoney(p.balanceMovement) +
          "</td>");
    PeriodRows.appendChild(row);
  }

  TotalPolicies.textContent = totalPolicies;
  TotalMovement.textContent = hidePricing ? "" : formatSignedMoney(totalMovement);
  StatPolicies.textContent = totalPolicies;

  renderBanner(b);
  InactivePoliciesPanel.classList.add("hidden");
  if (!sameBroker) resetPoliciesRange();
  policySort = { key: "created", dir: -1 };

  EmptyState.classList.add("hidden");
  Detail.classList.remove("hidden");

  await loadPolicies();
}

BrokerSearch.addEventListener("input", renderBrokerList);

async function loadPolicies() {
  if (!selectedId) return;
  // Only the latest request may update the panel: changing the dates (or the
  // broker) quickly must not let an older, slower response overwrite it.
  const requestId = ++policiesRequestId;
  PoliciesPanel.classList.add("is-loading");
  try {
    const data = await api(
      "/brokers/" + selectedId + "/policies" + policiesRangeParams()
    );
    if (requestId !== policiesRequestId) return;
    PoliciesPanel.classList.remove("is-loading");
    renderPolicies(data);
    PoliciesPanel.classList.remove("hidden");
    InactivePoliciesPanel.classList.add("hidden");
  } catch (err) {
    if (requestId !== policiesRequestId) return;
    PoliciesPanel.classList.remove("is-loading");
    policiesData = [];
    policiesPage = 1;
    renderPoliciesPager(1);
    renderPoliciesSince();
    PoliciesRows.innerHTML = "";
    const row = document.createElement("tr");
    row.innerHTML =
      '<td colspan="5" class="policies-empty">' +
      escapeHtml(err.message || t("policies.loadFailed")) +
      "</td>";
    PoliciesRows.appendChild(row);
    PoliciesTotalBalance.textContent = "";
    renderPoliciesBreakdown();
    PoliciesPanel.classList.remove("hidden");
    InactivePoliciesPanel.classList.add("hidden");
  }
}

PoliciesBtn.addEventListener("click", async () => {
  if (!selectedId) return;
  if (!PoliciesPanel.classList.contains("hidden")) {
    PoliciesPanel.classList.add("hidden");
    InactivePoliciesPanel.classList.add("hidden");
    return;
  }
  await loadPolicies();
});

InactivePoliciesBtn.addEventListener("click", async () => {
  if (!selectedId) return;
  if (!InactivePoliciesPanel.classList.contains("hidden")) {
    InactivePoliciesPanel.classList.add("hidden");
    return;
  }
  try {
    const data = await api("/brokers/" + selectedId + "/inactive-policies");
    renderInactivePolicies(data);
    InactivePoliciesPanel.classList.remove("hidden");
    PoliciesPanel.classList.add("hidden");
  } catch (err) {
    InactivePoliciesRows.innerHTML = "";
    const row = document.createElement("tr");
    row.innerHTML =
      '<td class="policies-empty">' +
      escapeHtml(err.message || t("inactive.loadFailed")) +
      "</td>";
    InactivePoliciesRows.appendChild(row);
    InactivePoliciesCount.textContent = "";
    InactivePoliciesPanel.classList.remove("hidden");
    PoliciesPanel.classList.add("hidden");
  }
});

function inactiveBlancNumber(p) {
  return p.BlancNumber ?? p.Blanc ?? p.blancNumber ?? p.Number ?? p.number ?? p.id ?? p;
}

function renderInactivePolicies(data) {
  const list = Array.isArray(data)
    ? data
    : (data && (data.policies || data.inactivePolicies || data.blancs || data.inactiveBlancs)) || [];
  InactivePoliciesRows.innerHTML = "";

  if (list.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML =
      '<td class="policies-empty">' +
      escapeHtml(t("inactive.empty")) +
      "</td>";
    InactivePoliciesRows.appendChild(row);
  } else {
    for (const p of list) {
      const row = document.createElement("tr");
      row.innerHTML = "<td>" + escapeHtml(inactiveBlancNumber(p)) + "</td>";
      InactivePoliciesRows.appendChild(row);
    }
  }
  InactivePoliciesCount.textContent = t("list.inactive", { n: list.length });
}

async function load() {
  try {
    const data = await api("/brokers/biweekly");
    brokers = data.brokers || [];
    schedule = data.schedule || null;
    // The sub-brokers report is scoped to the current bi-weekly cycle, which
    // is only known once the schedule above has loaded.
    if (isBroker) await loadUnderlings();
    renderBrokerList();
    loadReport();
    loadCashInflow();
    if (brokers.length > 0) await selectBroker(brokers[0].id);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      clearSession();
      window.location.replace("index.html");
      return;
    }
    BrokerList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "broker-item muted";
    li.textContent = err.message || t("list.loadFailed");
    BrokerList.appendChild(li);
  }
}

// Re-render dynamic content when the language changes.
onLangChange(() => {
  applyBrokerMode();
  renderBrokerList();
  loadCashInflow();
  if (selectedId !== null) {
    const b = brokers.find((x) => x.id === selectedId);
    if (b) selectBroker(b.id);
  }
});

load();

// --- Account settings & admin registrations --------------------------------

const SettingsOverlay = document.getElementById("SettingsOverlay");
const SettingsBtn = document.getElementById("SettingsBtn");
const SettingsCloseBtn = document.getElementById("SettingsCloseBtn");
const PasswordForm = document.getElementById("PasswordForm");
const CurrentPassInput = document.getElementById("CurrentPassInput");
const NewPassInput = document.getElementById("NewPassInput");
const ConfirmPassInput = document.getElementById("ConfirmPassInput");
const PasswordMsg = document.getElementById("PasswordMsg");
const EmailSection = document.getElementById("EmailSection");
const EmailList = document.getElementById("EmailList");
const EmailInput = document.getElementById("EmailInput");
const EmailAddBtn = document.getElementById("EmailAddBtn");
const EmailSaveBtn = document.getElementById("EmailSaveBtn");
const EmailMsg = document.getElementById("EmailMsg");
const RegistrationsOverlay = document.getElementById("RegistrationsOverlay");
const RegistrationsBtn = document.getElementById("RegistrationsBtn");
const RegistrationsCloseBtn = document.getElementById("RegistrationsCloseBtn");
const PendingList = document.getElementById("PendingList");
const PendingMsg = document.getElementById("PendingMsg");

let settingsEmails = [];

function setMsg(el, text, isError) {
  el.textContent = text || "";
  el.className = "msg " + (isError ? "error" : "success");
  if (!text) el.className = "msg";
}

function openOverlay(el) {
  el.classList.remove("hidden");
}
function closeOverlay(el) {
  el.classList.add("hidden");
}

// --- Settings ---------------------------------------------------------------

async function openSettings() {
  setMsg(PasswordMsg, "", false);
  setMsg(EmailMsg, "", false);
  PasswordForm.reset();
  settingsEmails = [];
  renderEmailList();
  openOverlay(SettingsOverlay);
  try {
    const account = await api("/account");
    settingsEmails = account.emails || [];
    EmailSection.classList.toggle("hidden", !account.canManageEmails);
    renderEmailList();
  } catch (err) {
    settingsEmails = [];
    EmailSection.classList.add("hidden");
    setMsg(EmailMsg, err.message || t("settings.loadFailed"), true);
  }
}

function renderEmailList() {
  EmailList.innerHTML = "";
  if (settingsEmails.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("settings.emails.empty");
    EmailList.appendChild(li);
    return;
  }
  for (const email of settingsEmails) {
    const li = document.createElement("li");
    li.className = "email-item";
    const span = document.createElement("span");
    span.textContent = email;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-ghost btn-small";
    btn.textContent = t("settings.emails.remove");
    btn.addEventListener("click", () => {
      settingsEmails = settingsEmails.filter((e) => e !== email);
      renderEmailList();
    });
    li.appendChild(span);
    li.appendChild(btn);
    EmailList.appendChild(li);
  }
}

function addEmail() {
  const email = EmailInput.value.trim();
  if (!email) return;
  EmailInput.value = "";
  if (settingsEmails.includes(email)) return;
  settingsEmails.push(email);
  renderEmailList();
}

SettingsBtn.addEventListener("click", openSettings);
SettingsCloseBtn.addEventListener("click", () => closeOverlay(SettingsOverlay));

EmailAddBtn.addEventListener("click", addEmail);
EmailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addEmail();
  }
});

EmailSaveBtn.addEventListener("click", async () => {
  try {
    const data = await api("/account/emails", {
      method: "PUT",
      body: JSON.stringify({ emails: settingsEmails }),
    });
    settingsEmails = data.emails || [];
    renderEmailList();
    setMsg(EmailMsg, t("settings.emails.saved"), false);
  } catch (err) {
    setMsg(EmailMsg, err.message || t("settings.emails.saveFailed"), true);
  }
});

PasswordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const current = CurrentPassInput.value;
  const next = NewPassInput.value;
  const confirm = ConfirmPassInput.value;

  if (!current || !next) {
    setMsg(PasswordMsg, t("settings.password.required"), true);
    return;
  }
  if (next.length < 6) {
    setMsg(PasswordMsg, t("register.passwordTooShort"), true);
    return;
  }
  if (next !== confirm) {
    setMsg(PasswordMsg, t("register.passwordMismatch"), true);
    return;
  }

  try {
    await api("/account/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    PasswordForm.reset();
    setMsg(PasswordMsg, t("settings.password.success"), false);
  } catch (err) {
    setMsg(PasswordMsg, err.message || t("settings.password.failed"), true);
  }
});

// --- Admin pending registrations --------------------------------------------

if (role === "1" && RegistrationsBtn) {
  RegistrationsBtn.classList.remove("hidden");
}

async function openRegistrations() {
  setMsg(PendingMsg, "", false);
  openOverlay(RegistrationsOverlay);
  await loadPending();
}

async function loadPending() {
  PendingList.innerHTML = "";
  setMsg(PendingMsg, "", false);
  try {
    const data = await api("/admin/users");
    const pending = (data.users || []).filter(
      (u) => String(u.Status) === "pending"
    );
    renderPending(pending);
  } catch (err) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = err.message || t("admin.pending.loadFailed");
    PendingList.appendChild(li);
  }
}

function brokerOptions() {
  let html =
    '<option value="">' + escapeHtml(t("admin.pending.selectBroker")) + "</option>";
  for (const b of brokers) {
    html += `<option value="${b.id}">${escapeHtml(b.Name)}</option>`;
  }
  return html;
}

function renderPending(pending) {
  if (pending.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("admin.pending.empty");
    PendingList.appendChild(li);
    return;
  }

  for (const u of pending) {
    const li = document.createElement("li");
    li.className = "pending-item";

    const info = document.createElement("div");
    info.className = "pending-info";
    const name = document.createElement("div");
    name.className = "pending-name";
    name.textContent = u.Username;
    const meta = document.createElement("div");
    meta.className = "pending-meta";
    meta.textContent = [
      u.Email || "",
      u.CreatedAt ? formatDate(String(u.CreatedAt).slice(0, 10)) : "",
    ]
      .filter(Boolean)
      .join(" · ");
    info.appendChild(name);
    info.appendChild(meta);

    const controls = document.createElement("div");
    controls.className = "pending-controls";
    const select = document.createElement("select");
    select.className = "pending-select";
    select.innerHTML = brokerOptions();
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn-primary btn-small";
    approve.textContent = t("admin.pending.approve");
    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn-ghost btn-small";
    reject.textContent = t("admin.pending.reject");

    approve.addEventListener("click", async () => {
      const brokerId = select.value;
      if (!brokerId) {
        setMsg(PendingMsg, t("admin.pending.selectBroker"), true);
        return;
      }
      try {
        await api("/admin/users/" + encodeURIComponent(u.Username) + "/approve", {
          method: "POST",
          body: JSON.stringify({ brokerId: Number(brokerId) }),
        });
        setMsg(PendingMsg, t("admin.pending.approved", { name: u.Username }), false);
        await loadPending();
      } catch (err) {
        setMsg(PendingMsg, err.message || t("admin.pending.approveFailed"), true);
      }
    });

    reject.addEventListener("click", async () => {
      try {
        await api("/admin/users/" + encodeURIComponent(u.Username) + "/delete", {
          method: "POST",
        });
        setMsg(PendingMsg, t("admin.pending.rejected", { name: u.Username }), false);
        await loadPending();
      } catch (err) {
        setMsg(PendingMsg, err.message || t("admin.pending.rejectFailed"), true);
      }
    });

    controls.appendChild(select);
    controls.appendChild(approve);
    controls.appendChild(reject);
    li.appendChild(info);
    li.appendChild(controls);
    PendingList.appendChild(li);
  }
}

RegistrationsBtn.addEventListener("click", openRegistrations);
RegistrationsCloseBtn.addEventListener("click", () =>
  closeOverlay(RegistrationsOverlay)
);

// --- Admin branches ----------------------------------------------------------

const BranchesOverlay = document.getElementById("BranchesOverlay");
const BranchesBtn = document.getElementById("BranchesBtn");
const BranchesCloseBtn = document.getElementById("BranchesCloseBtn");
const BranchList = document.getElementById("BranchList");
const NewBranchInput = document.getElementById("NewBranchInput");
const CreateBranchBtn = document.getElementById("CreateBranchBtn");
const BranchMsg = document.getElementById("BranchMsg");

if (role === "1" && BranchesBtn) {
  BranchesBtn.classList.remove("hidden");
}

async function openBranches() {
  setMsg(BranchMsg, "", false);
  openOverlay(BranchesOverlay);
  await loadBranches();
}

async function loadBranches() {
  BranchList.innerHTML = "";
  setMsg(BranchMsg, "", false);
  try {
    const data = await api("/admin/branches");
    renderBranches(data.branches || []);
  } catch (err) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = err.message || t("admin.branches.loadFailed");
    BranchList.appendChild(li);
  }
}

function renderBranches(branches) {
  if (branches.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = t("admin.branches.empty");
    BranchList.appendChild(li);
    return;
  }

  for (const b of branches) {
    const li = document.createElement("li");
    li.className = "branch-item";

    const name = document.createElement("span");
    name.className = "branch-name";
    name.textContent = b.Name;

    const label = document.createElement("label");
    label.className = "switch";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(b.Enabled);

    const track = document.createElement("span");
    track.className = "switch-track";
    const knob = document.createElement("span");
    knob.className = "switch-knob";
    track.appendChild(knob);

    const statusText = document.createElement("span");
    statusText.className = "switch-label";
    statusText.textContent = checkbox.checked
      ? t("admin.branches.on")
      : t("admin.branches.off");

    checkbox.addEventListener("change", async () => {
      const enabled = checkbox.checked;
      statusText.textContent = enabled
        ? t("admin.branches.on")
        : t("admin.branches.off");
      try {
        await api("/admin/branches/" + encodeURIComponent(b.id), {
          method: "PATCH",
          body: JSON.stringify({ enabled }),
        });
        setMsg(
          BranchMsg,
          enabled
            ? t("admin.branches.enabled", { name: b.Name })
            : t("admin.branches.disabled", { name: b.Name }),
          false
        );
      } catch (err) {
        checkbox.checked = !enabled;
        statusText.textContent = checkbox.checked
          ? t("admin.branches.on")
          : t("admin.branches.off");
        setMsg(BranchMsg, err.message || t("admin.branches.toggleFailed"), true);
      }
    });

    label.appendChild(checkbox);
    label.appendChild(track);
    label.appendChild(statusText);

    li.appendChild(name);
    li.appendChild(label);
    BranchList.appendChild(li);
  }
}

async function createBranch() {
  const name = NewBranchInput.value.trim();
  if (!name) {
    setMsg(BranchMsg, t("admin.branches.nameRequired"), true);
    return;
  }
  try {
    await api("/admin/branches", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    NewBranchInput.value = "";
    setMsg(BranchMsg, t("admin.branches.created", { name }), false);
    await loadBranches();
  } catch (err) {
    setMsg(BranchMsg, err.message || t("admin.branches.createFailed"), true);
  }
}

BranchesBtn.addEventListener("click", openBranches);
BranchesCloseBtn.addEventListener("click", () => closeOverlay(BranchesOverlay));
CreateBranchBtn.addEventListener("click", createBranch);
NewBranchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    createBranch();
  }
});

// Keep the dynamic branch list labels in sync when the language changes.
onLangChange(() => {
  if (BranchesOverlay && !BranchesOverlay.classList.contains("hidden")) {
    loadBranches();
  }
});

// --- Main broker: sub-brokers (underlings) + per-broker pricing -------------

const SubBrokersPanel = document.getElementById("SubBrokersPanel");
const UnderlingsList = document.getElementById("UnderlingsList");
const UnderlingFrom = document.getElementById("UnderlingFrom");
const UnderlingTo = document.getElementById("UnderlingTo");
const UnderlingClearBtn = document.getElementById("UnderlingClearBtn");
const UnderlingPrevCycle = document.getElementById("UnderlingPrevCycle");
const UnderlingNextCycle = document.getElementById("UnderlingNextCycle");
const UnderlingsTotals = document.getElementById("UnderlingsTotals");
const TotalsShowOnly = document.getElementById("TotalsShowOnly");
const TotalsMainPrice = document.getElementById("TotalsMainPrice");
const TotalsProfit = document.getElementById("TotalsProfit");
const TotalsTotalOwed = document.getElementById("TotalsTotalOwed");
const TotalsTotalOwedLabel = document.getElementById("TotalsTotalOwedLabel");
const PricingOverlay = document.getElementById("PricingOverlay");
const PricingTitle = document.getElementById("PricingTitle");
const PricingMeta = document.getElementById("PricingMeta");
const PricingTable = document.getElementById("PricingTable");
const PricingSaveBtn = document.getElementById("PricingSaveBtn");
const PricingMsg = document.getElementById("PricingMsg");
const PricingCloseBtn = document.getElementById("PricingCloseBtn");

const myBrokerId = getBrokerId() ? Number(getBrokerId()) : null;
let pricingTarget = null; // { id, name }
let pricingData = null;   // { vehicleType: { duration: price } }

// The date inputs default to the current bi-weekly payment cycle. Once the
// user picks dates this is set, so later reloads (language change, pricing
// save) keep their range instead of snapping back to the cycle.
let underlingsRangeTouched = false;

// The current bi-weekly payment cycle (the 14 days that settle on the next
// cutoff). Until the schedule has loaded, fall back to the last two weeks.
function defaultUnderlingRange() {
  const start =
    schedule && schedule.periodStart ? toDate(schedule.periodStart) : null;
  const end = schedule && schedule.periodEnd ? toDate(schedule.periodEnd) : null;
  if (start && end) {
    return { from: localDateString(start), to: localDateString(end) };
  }
  const e = new Date();
  const s = new Date();
  s.setDate(e.getDate() - 13);
  return { from: localDateString(s), to: localDateString(e) };
}

// Length of one payment cycle in days, as reported by the server (14).
function underlingCycleDays() {
  const days = Number(schedule && schedule.periodLengthDays);
  return Number.isFinite(days) && days > 0 ? days : 14;
}

// The next-cycle arrow stops at the cycle that ends the current period, since
// there are no newer insurances to report yet.
function updateUnderlingCycleButtons() {
  if (!UnderlingNextCycle) return;
  const latestEnd = toDate(defaultUnderlingRange().to);
  const selectedEnd = toDate(UnderlingTo ? UnderlingTo.value : "");
  UnderlingNextCycle.disabled = Boolean(
    latestEnd && selectedEnd && selectedEnd.getTime() >= latestEnd.getTime()
  );
}

// Write the cycle default into the From/To inputs. A range the user picked is
// left alone unless `force` is set (the Clear button).
function applyUnderlingDefaultRange(force) {
  if (!UnderlingFrom || !UnderlingTo) return false;
  if (!force && underlingsRangeTouched) return false;
  const range = defaultUnderlingRange();
  const changed =
    UnderlingFrom.value !== range.from || UnderlingTo.value !== range.to;
  UnderlingFrom.value = range.from;
  UnderlingTo.value = range.to;
  updateUnderlingCycleButtons();
  return changed;
}

// Keep the cycle-arrow tooltips in the active language.
function localizeUnderlingCycleArrows() {
  const prev = t("underlings.prevCycle");
  const next = t("underlings.nextCycle");
  if (UnderlingPrevCycle) {
    UnderlingPrevCycle.title = prev;
    UnderlingPrevCycle.setAttribute("aria-label", prev);
  }
  if (UnderlingNextCycle) {
    UnderlingNextCycle.title = next;
    UnderlingNextCycle.setAttribute("aria-label", next);
  }
}

// Move the whole From/To range exactly one payment cycle back (-1) or
// forward (+1).
function shiftUnderlingsCycle(direction) {
  if (!UnderlingFrom || !UnderlingTo) return;
  const fallback = defaultUnderlingRange();
  const from = toDate(UnderlingFrom.value || fallback.from);
  const to = toDate(UnderlingTo.value || fallback.to);
  if (!from || !to) return;
  const days = underlingCycleDays() * direction;
  from.setDate(from.getDate() + days);
  to.setDate(to.getDate() + days);
  UnderlingFrom.value = localDateString(from);
  UnderlingTo.value = localDateString(to);
  underlingsRangeTouched = true;
  updateUnderlingCycleButtons();
  loadUnderlings();
}

function underlingDateParams() {
  const from = UnderlingFrom ? UnderlingFrom.value.trim() : "";
  const to = UnderlingTo ? UnderlingTo.value.trim() : "";
  const qs = [];
  if (from) qs.push("from=" + encodeURIComponent(from));
  if (to) qs.push("to=" + encodeURIComponent(to));
  return qs.length ? "?" + qs.join("&") : "";
}

async function loadUnderlings() {
  if (!isBroker || !myBrokerId || !SubBrokersPanel) return;
  // Ensure the report is always scoped to a range (the current cycle by
  // default) instead of falling back to the broker's whole history.
  applyUnderlingDefaultRange(false);
  try {
    const data = await api(
      "/brokers/" + myBrokerId + "/underlings" + underlingDateParams()
    );
    const list = data.underlings || [];
    if (list.length === 0) {
      SubBrokersPanel.classList.add("hidden");
      return;
    }
    SubBrokersPanel.classList.remove("hidden");
    renderUnderlings(list, data);
  } catch (err) {
    if (err.status === 403) {
      SubBrokersPanel.classList.add("hidden");
      return;
    }
    if (UnderlingsTotals) {
      UnderlingsTotals.classList.add("hidden");
    }
    UnderlingsList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = err.message || t("underlings.loadFailed");
    UnderlingsList.appendChild(li);
    SubBrokersPanel.classList.remove("hidden");
  }
}

function underlingExcelName(name) {
  return String(name || "sub-broker")
    .replace(/[\\/:*?"<>|]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function exportUnderlingExcel(u, btn) {
  const original = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "…";
  }
  try {
    const data = await api(
      "/brokers/" + u.id + "/policies" + underlingDateParams()
    );
    const policies = data.policies || [];
    const hidePricing =
      data.hidePricing !== undefined
        ? Boolean(data.hidePricing)
        : isPricingHidden(u);
    downloadExcel(
      buildPoliciesExcel(policies, hidePricing),
      "policies-" + (underlingExcelName(u.Name) || u.id) + ".xls"
    );
  } catch (err) {
    alert(err.message || t("policies.loadFailed"));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = original;
    }
  }
}

function buildBalanceChip(label, value, cls) {
  const chip = document.createElement("span");
  chip.className = "balance-chip " + cls;
  const lab = document.createElement("span");
  lab.className = "balance-label";
  lab.textContent = label;
  const val = document.createElement("span");
  val.className = "balance-value";
  val.textContent = value;
  chip.appendChild(lab);
  chip.appendChild(val);
  return chip;
}

function renderUnderlings(list, data) {
  UnderlingsList.innerHTML = "";
  let anyVisible = false;
  // Sum of every sub-broker's current balance (negative = still owed). It is
  // added to the main broker's own balance for the combined "Total owed".
  let subBrokersBalance = 0;
  for (const u of list) {
    const li = document.createElement("li");
    li.className = "underling-item";

    const name = document.createElement("button");
    name.type = "button";
    name.className = "underling-name";
    name.textContent = u.Name;
    name.title = t("pricing.title");
    name.addEventListener("click", () => openPricing(u.id, u.Name));

    const hidden = isPricingHidden(u);
    if (!hidden) anyVisible = true;

    const meta = document.createElement("span");
    meta.className = "underling-meta";
    meta.textContent = t("underlings.policiesCount", { n: u.policyCount });

    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.className = "btn-ghost btn-small underling-export";
    exportBtn.textContent = t("policies.export");
    exportBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      exportUnderlingExcel(u, exportBtn);
    });

    const actions = document.createElement("div");
    actions.className = "underling-actions";
    actions.appendChild(meta);

    if (!hidden) {
      const showOnly = Number(u.showOnlyTotal ?? u.totalPrice ?? u.totalBalance ?? 0);
      const mainPrice = Number(u.mainPriceTotal ?? 0);
      const profit =
        u.profit !== undefined && u.profit !== null
          ? Number(u.profit)
          : showOnly - mainPrice;
      actions.appendChild(
        buildBalanceChip(t("underlings.showOnly"), formatMoney(showOnly), "show")
      );
      actions.appendChild(
        buildBalanceChip(t("underlings.mainPrice"), formatMoney(mainPrice), "main")
      );
      actions.appendChild(
        buildBalanceChip(
          t("underlings.profit"),
          formatSignedMoney(profit),
          "profit" + (profit < 0 ? " negative" : "")
        )
      );
      // Current balance of this sub-broker, as stored on the broker record:
      // a negative balance is money owed (shown as a positive "Total owed"),
      // a positive one is leftover credit carried into the next cycle.
      const balance = Number(u.CashBalance ?? 0);
      subBrokersBalance += balance;
      const owes = balance < 0;
      actions.appendChild(
        buildBalanceChip(
          owes ? t("underlings.totalOwed") : t("underlings.leftoverBalance"),
          formatMoney(Math.abs(balance)),
          owes ? "owed" : "leftover"
        )
      );
    }

    actions.appendChild(exportBtn);

    li.appendChild(name);
    li.appendChild(actions);
    UnderlingsList.appendChild(li);
  }

  renderUnderlingsTotals(data, anyVisible, subBrokersBalance);
}

function renderUnderlingsTotals(data, anyVisible, subBrokersBalance) {
  if (!UnderlingsTotals) return;
  const totals = data && data.totals;
  if (!anyVisible || !totals) {
    UnderlingsTotals.classList.add("hidden");
    return;
  }
  UnderlingsTotals.classList.remove("hidden");
  const showOnly = Number(totals.showOnly ?? 0);
  const mainPrice = Number(totals.mainPrice ?? 0);
  const profit =
    totals.profit !== undefined && totals.profit !== null
      ? Number(totals.profit)
      : showOnly - mainPrice;
  TotalsShowOnly.textContent = formatMoney(showOnly);
  TotalsMainPrice.textContent = formatMoney(mainPrice);
  TotalsProfit.textContent = formatSignedMoney(profit);
  const profitChip = TotalsProfit.closest(".balance-chip");
  if (profitChip) profitChip.classList.toggle("negative", profit < 0);

  // Combined total owed by the main broker: its own current balance plus the
  // current balance of every sub-broker. Negative = money still owed, so it is
  // shown as a positive "Total owed"; positive = leftover credit.
  const ownBroker = brokers.find((b) => Number(b.id) === Number(myBrokerId));
  const ownBalance = Number((ownBroker && ownBroker.CashBalance) ?? 0);
  const totalBalance = ownBalance + Number(subBrokersBalance || 0);
  const totalOwes = totalBalance < 0;
  if (TotalsTotalOwed) {
    TotalsTotalOwed.textContent = formatMoney(Math.abs(totalBalance));
  }
  if (TotalsTotalOwedLabel) {
    TotalsTotalOwedLabel.textContent = totalOwes
      ? t("underlings.totalOwed")
      : t("underlings.leftoverBalance");
  }
  const totalChip = TotalsTotalOwed
    ? TotalsTotalOwed.closest(".balance-chip")
    : null;
  if (totalChip) {
    totalChip.classList.toggle("owed", totalOwes);
    totalChip.classList.toggle("leftover", !totalOwes);
    totalChip.title = t("underlings.totalOwed.hint");
  }
}

UnderlingFrom.addEventListener("change", () => {
  underlingsRangeTouched = true;
  updateUnderlingCycleButtons();
  loadUnderlings();
});
UnderlingTo.addEventListener("change", () => {
  underlingsRangeTouched = true;
  updateUnderlingCycleButtons();
  loadUnderlings();
});
// Clearing the filters goes back to the cycle default (not "all time").
UnderlingClearBtn.addEventListener("click", () => {
  underlingsRangeTouched = false;
  applyUnderlingDefaultRange(true);
  loadUnderlings();
});
UnderlingPrevCycle.addEventListener("click", () => shiftUnderlingsCycle(-1));
UnderlingNextCycle.addEventListener("click", () => shiftUnderlingsCycle(1));
localizeUnderlingCycleArrows();

// Open a date input's calendar from anywhere inside the field (not only the
// small calendar glyph on the right). showPicker() is preferred; when it is
// unavailable the field is focused so the user can type a date.
function openDatePicker(input) {
  if (!input) return;
  try {
    if (typeof input.showPicker === "function") input.showPicker();
    else input.focus();
  } catch {
    input.focus();
  }
}

// Wire every native date input (report, policies range + sub-broker filters).
document.querySelectorAll('input[type="date"]').forEach((input) => {
  input.addEventListener("click", () => openDatePicker(input));
});

// --- Per-broker pricing modal ---------------------------------------------

function buildPricingGrid(pricing) {
  const types = Object.keys(pricing || {}).sort();
  const durations = new Set();
  for (const t of types) {
    for (const d of Object.keys(pricing[t] || {})) durations.add(Number(d));
  }
  return { types, durations: Array.from(durations).sort((a, b) => a - b) };
}

function renderPricingGrid() {
  const pricing = pricingData || {};
  const { types, durations } = buildPricingGrid(pricing);

  PricingTable.innerHTML = "";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  const thType = document.createElement("th");
  thType.textContent = t("pricing.vehicleType");
  hr.appendChild(thType);
  for (const d of durations) {
    const th = document.createElement("th");
    th.className = "num";
    th.textContent = d;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  PricingTable.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const typeName of types) {
    const tr = document.createElement("tr");
    const tdType = document.createElement("td");
    tdType.textContent = typeName;
    tr.appendChild(tdType);
    for (const d of durations) {
      const td = document.createElement("td");
      td.className = "num";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.className = "pricing-input";
      input.dataset.type = typeName;
      input.dataset.duration = String(d);
      const val = pricing[typeName] && pricing[typeName][String(d)];
      if (val !== undefined && val !== null && val !== "") input.value = Math.round(Number(val));
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  PricingTable.appendChild(tbody);
}

async function openPricing(brokerId, brokerName) {
  pricingTarget = { id: brokerId, name: brokerName };
  PricingTitle.textContent = t("pricing.title") + ": " + brokerName;
  PricingMeta.textContent = "";
  PricingMsg.textContent = "";
  PricingMsg.className = "msg";
  openOverlay(PricingOverlay);
  try {
    const data = await api("/brokers/" + brokerId + "/pricing");
    pricingData = data.pricing || {};
    if (data.inherited && data.sourceBrokerName) {
      PricingMeta.textContent = t("pricing.inherited", {
        name: data.sourceBrokerName,
      });
    }
    renderPricingGrid();
  } catch (err) {
    PricingTable.innerHTML = "";
    PricingMeta.textContent = "";
    setMsg(PricingMsg, err.message || t("pricing.loadFailed"), true);
  }
}

function collectPricing() {
  const pricing = {};
  PricingTable.querySelectorAll("input.pricing-input").forEach((input) => {
    const typeName = input.dataset.type;
    const duration = input.dataset.duration;
    const raw = input.value.trim();
    if (raw === "") return;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) return;
    if (!pricing[typeName]) pricing[typeName] = {};
    pricing[typeName][duration] = num;
  });
  return pricing;
}

PricingSaveBtn.addEventListener("click", async () => {
  if (!pricingTarget) return;
  try {
    const data = await api("/brokers/" + pricingTarget.id + "/pricing", {
      method: "PUT",
      body: JSON.stringify({ pricing: collectPricing() }),
    });
    pricingData = data.pricing || {};
    PricingMeta.textContent = "";
    setMsg(PricingMsg, t("pricing.saved"), false);
    renderPricingGrid();
    await load();
  } catch (err) {
    setMsg(PricingMsg, err.message || t("pricing.saveFailed"), true);
  }
});

PricingCloseBtn.addEventListener("click", () => closeOverlay(PricingOverlay));

onLangChange(() => {
  localizeUnderlingCycleArrows();
  if (isBroker) loadUnderlings();
});
