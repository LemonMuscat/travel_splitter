const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const XLSX = require("../vendor/xlsx.full.min.js");

const root = path.resolve(__dirname, "..");
const elements = new Map();
const context = vm.createContext({
  console, Date, URLSearchParams, AbortController, setTimeout, clearTimeout,
  document: { querySelector: (selector) => {
    if (!elements.has(selector)) elements.set(selector, {});
    return elements.get(selector);
  } },
  window: { XLSX },
});
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
vm.runInContext(source.slice(0, source.lastIndexOf("initializeApp().catch")), context);
vm.runInContext(`render = () => {}; renderRateStatus = () => {};`, context);
const run = (code) => vm.runInContext(code, context);
const plain = (value) => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name, test) { test(); checks += 1; console.log(`PASS ${name}`); }

const headers = ["날짜", "자산", "분류", "소분류", "내용", "금액(원)", "수입/지출", "태그", "메모", "금액", "화폐"];
const rows = [headers,
  ["2026. 11. 07 14:46:00", "KB 헤리티지", "여행", "개인용", "테스트 카페", 20000, "지출", "", "[Web발신] KB국민카드 승인 20,000원 일시불 누적1,881,021원", 20000, "KRW"],
  ["2026-11-05 23:32:00", "KB", "식료품구매", "가족", "테스트 식료품", 70000, "지출", "", "", 70000, "KRW"],
  ["2026-11-03 16:32:00", "우리카드", "건강", "가족", "테스트 병원", 30500, "지출", "", "", 30500, "KRW"],
  ["2026-11-03 16:32:00", "현금", "수입", "", "급여", 500000, "수입", "", "일시불 500,000원", 500000, "KRW"],
];
context.rows = rows;
const tsv = rows.map((row) => row.join("\t")).join("\n");
context.tsv = tsv;
check("all expense categories, dates and memo isolation", () => {
  const result = run("parseLedgerText(tsv)");
  assert.equal(result.length, 3);
  assert.equal(result.reduce((sum, row) => sum + row.amount, 0), 120500);
  assert.equal(result[0].date, "2026-11-07");
  assert.equal(result[0].time, "14:46");
});
check("headerless table and old export without tags", () => {
  assert.equal(run("parseLedgerText(rowsToTsv(rows.slice(1)))").length, 3);
  context.noTagRows = rows.map((row) => row.filter((_, index) => index !== 7));
  assert.equal(run("parseLedgerText(rowsToTsv(noTagRows))").length, 3);
});
check("income-only ledger never falls through to card parsing", () => {
  context.income = [headers, rows[4]];
  assert.equal(run("parseLedgerText(rowsToTsv(income))").length, 0);
});
check("CSV quoting, escaped quotes, multiline memo, BOM and preamble", () => {
  const csvRows = [headers, [...rows[1]]];
  csvRows[1][4] = '테스트 "가족", 카페';
  csvRows[1][8] = 'memo\n20,000원 승인 "확인"';
  context.csv = "\uFEFFexport\r\n" + csvRows.map((row) => row.map((cell) => '"' + String(cell).replace(/"/g, '""') + '"').join(",")).join("\r\n");
  const result = run("parseLedgerText(csv)");
  assert.equal(result.length, 1);
  assert.equal(result[0].title, '테스트 "가족", 카페');
  assert.equal(result[0].amount, 20000);
});
check("screen copy with cells on separate lines", () => {
  context.screen = rows.map((row) => row.filter((cell) => cell !== "").join("\n")).join("\n");
  const result = run("parseLedgerText(screen)");
  assert.equal(result.length, 3);
  assert.equal(result.reduce((sum, row) => sum + row.amount, 0), 120500);
});
check("same merchant on the same day at different times survives deduplication", () => {
  run(`state = createTrip(); state.rateMode = "manual";`);
  context.twice = [{ ...run("parseLedgerText(tsv)[0]") }, { ...run("parseLedgerText(tsv)[0]"), time: "15:46" }];
  assert.equal(run("importExpenses(twice)"), 2);
  assert.equal(run("importExpenses(twice)"), 0);
});
check("KB and Shinhan statement formats still work", () => {
  context.kb = "KB Pay\n06월29일\n테스트 가맹점\n44,400원\n01:23\n일시불\n전표매입";
  context.shinhan = "테스트 가맹점\n8,300원\n2026.11.03 16:34 일시불";
  assert.equal(run("parseLedgerText(kb)")[0].amount, 44400);
  assert.equal(run("parseLedgerText(shinhan)")[0].date, "2026-11-03");
});
check("monthly app screen copy uses its month without duplicate recovery", () => {
  context.monthScreen = "2026. 10\n30 금요일\n여행 / 공금\nKB일본 호텔\n20,000원\n15:30";
  const result = run("parseLedgerText(monthScreen)");
  assert.equal(result.length, 1);
  assert.equal(result[0].date, "2026-10-30");
});
check("manual, historical, fixed KRW, changed dates, old backups", () => {
  run(`state = normalizeTrip({people:["나"], rates:{JPY:10}, rateMode:"expense-date", dailyRates:{"2026-11-07":{rates:{JPY:9},dates:{JPY:"2026-11-06"}}}});`);
  context.expense = run(`normalizeExpense({title:"외화",currency:"JPY",amount:1000,date:"2026-11-07",convertedAmountKrw:12345})`);
  assert.equal(run("toSettlementAmount(expense)"), 9000);
  assert.equal(run("toSettlementAmount({...expense,date:'2026-11-08'})"), 10000);
  assert.equal(run("toSettlementAmount({...expense,conversionFixed:true})"), 12345);
  run("state.rateMode = 'manual'; state.rates.JPY = 11;");
  assert.equal(run("toSettlementAmount(expense)"), 11000);
  assert.equal(run("normalizeTrip({rates:{JPY:12}}).rateMode"), "manual");
  assert.equal(run("normalizeTrip({rates:{USD:1390}}).rates.USD"), 1390);
});
check("backup and compact share retain historical rate snapshots", () => {
  run("state.rateMode='expense-date'; state.expenses=[normalizeExpense(expense)];");
  const before = run("toSettlementAmount(state.expenses[0])");
  run("state=normalizeTrip(expandCompactShare(compactSharePayload()));");
  assert.equal(run("toSettlementAmount(state.expenses[0])"), before);
  run("state=normalizeTrip(JSON.parse(JSON.stringify(state)));");
  assert.equal(run("toSettlementAmount(state.expenses[0])"), before);
});

async function asyncTests() {
  const samplePath = process.argv[2];
  if (samplePath) {
    const buffer = fs.readFileSync(samplePath);
    context.file = { arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
    context.fileRows = await run("readXlsxFileInBrowser(file)");
    const expected = XLSX.utils.sheet_to_json(XLSX.read(buffer, {type:"buffer"}).Sheets["내역"], {header:1}).slice(1);
    const fileExpenses = run("parseStructuredRows(fileRows)");
    const pasted = run("parseLedgerText(rowsToTsv(fileRows))");
    assert.equal(fileExpenses.length, 25);
    assert.equal(fileExpenses[0].date, "2026-11-07");
    assert.equal(fileExpenses[0].time, "14:46");
    assert.equal(fileExpenses[1].time, "11:47");
    assert.equal(fileExpenses.reduce((s, e) => s + e.amount, 0), expected.reduce((s, e) => s + e[5], 0));
    assert.deepEqual(plain(fileExpenses), plain(pasted));
    console.log(`PASS supplied XLSX and pasted text: ${fileExpenses.length} expenses, ${fileExpenses.reduce((s,e)=>s+e.amount,0)} KRW`);
    checks += 1;
  }
  context.fetch = async () => ({ok:true,json:async()=>[{base:"KRW",quote:"JPY",rate:0.1,date:"2026-11-07"},{base:"KRW",quote:"VND",rate:20,date:"2026-11-07"}]});
  const snapshot = await run("fetchRateSnapshot('2026-11-07')");
  assert.equal(snapshot.rates.JPY, 10);
  assert.equal(snapshot.rates.VND, 0.05);
  context.fetch = async (url) => {
    const date = new URL(url).searchParams.get("date");
    if (date === "2026-11-06") throw new Error("temporary historical failure");
    return {ok:true,json:async()=>[{base:"KRW",quote:"JPY",rate:date ? 0.125 : 0.1,date:date || "2026-11-10"}]};
  };
  run(`state=createTrip(); state.rateMode='expense-date'; state.expenses=[
    normalizeExpense({title:'old',currency:'JPY',amount:1000,date:'2026-11-07'}),
    normalizeExpense({title:'missing',currency:'JPY',amount:1000,date:'2026-11-06'}),
    normalizeExpense({title:'future',currency:'JPY',amount:1000,date:'2099-01-01'})
  ];`);
  await run("refreshExchangeRates()");
  assert.equal(run("toSettlementAmount(state.expenses[0])"), 8000);
  assert.equal(run("toSettlementAmount(state.expenses[1])"), 10000);
  assert.equal(run("missingHistoricalExpenses().length"), 2);
  assert.match(run("rateMessage"), /2個|2개/);
  console.log("PASS historical loading, partial failure and future-date fallback");
  checks += 1;
  run("state=createTrip(); state.rates.JPY=12;");
  context.fetch = async () => { throw new Error("offline"); };
  await run("refreshExchangeRates()");
  assert.equal(run("state.rates.JPY"), 12);
  assert.match(run("rateMessage"), /불러오지 못/);
  // An old request must not overwrite a manual edit made while it is in flight.
  let resolveFetch;
  context.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
  const pending = run("refreshExchangeRates()");
  run("rateRequestId++; state.rateMode='manual'; state.rates.JPY=13;");
  resolveFetch({ok:true,json:async()=>[{base:"KRW",quote:"JPY",rate:0.1,date:"2026-11-07"}]});
  await pending;
  assert.equal(run("state.rates.JPY"), 13);
  console.log("PASS rate direction, offline retention and in-flight manual override");
  checks += 1;
  console.log(`${checks} checks passed`);
}
asyncTests().catch((error) => { console.error(error); process.exitCode=1; });
