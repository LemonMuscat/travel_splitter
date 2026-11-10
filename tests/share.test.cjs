const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const LZString = require("../vendor/lz-string.min.js");

const elements = new Map();
const saved = new Map();
const context = vm.createContext({
  console, Date, URLSearchParams, AbortController, TextEncoder, TextDecoder,
  Uint8Array, setTimeout, clearTimeout, crypto: webcrypto, btoa, atob,
  window: { crypto: webcrypto, LZString, prompt() { throw new Error("No blocking password prompts"); } },
  location: { origin: "https://travel.hasebin.com", pathname: "/", hash: "" },
  localStorage: { getItem: (key) => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: (key) => saved.delete(key) },
  document: { querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, { value: "", textContent: "", hidden: false, disabled: false, open: false, scrollIntoView() {}, focus() {} });
    return elements.get(selector);
  } },
});
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
vm.runInContext(source.slice(0, source.lastIndexOf("initializeApp().catch")), context);
const run = (code) => vm.runInContext(code, context);
const element = (name) => elements.get(`#${name}`);
const key = "travel-splitter-share-create-token";
let count = 0;
async function check(name, fn) { await fn(); count += 1; console.log(`PASS ${name}`); }
function reset() {
  saved.clear();
  run(`shareRequestId++; sharePayload=null; state=normalizeTrip({tripName:'공유 테스트',people:['나','동행'],rateMode:'manual',rates:{JPY:10},expenses:[{title:'테스트 식당',amount:1000,currency:'JPY',date:'2026-11-07',time:'12:30'}]}); els.shortShareButton.disabled=false;`);
}

(async () => {
  await check("default link works without a password, network or prompt", async () => {
    reset();
    context.fetch = async () => { throw new Error("default link must not use the network"); };
    run("createShareLink()");
    assert.equal(element("settlementLinkPanel").hidden, false);
    assert.match(element("settlementLinkInput").value, /#share=v2\./);
    context.location.hash = new URL(element("settlementLinkInput").value).hash;
    const restored = await run("readSharedState()");
    assert.equal(restored.tripName, "공유 테스트");
    assert.equal(restored.expenses[0].amount, 1000);
    assert.equal(restored.rates.JPY, 10);
  });
  await check("link captures the shown snapshot while later edits remain local", async () => {
    const link = element("settlementLinkInput").value;
    run("state.people.push('추가 참가자'); state.expenses[0].amount=2000;");
    context.location.hash = new URL(link).hash;
    const restored = await run("readSharedState()");
    assert.equal(restored.people.length, 2);
    assert.equal(restored.expenses[0].amount, 1000);
    assert.equal(run("sharePayload.x[0][1]"), 1000);
  });
  await check("wrong password keeps a working link, clears invalid saved credentials and allows retry", async () => {
    reset(); run("createShareLink()");
    const fallback = element("settlementLinkInput").value;
    saved.set(key, "invalid-test-token");
    context.fetch = async () => ({ok:false,status:401,json:async()=>({error:"invalid password"})});
    await run("createShortShareLink('invalid-test-token')");
    assert.equal(element("settlementLinkInput").value, fallback);
    assert.equal(element("shortShareOptions").open, true);
    assert.match(element("shortShareStatus").textContent, /올바르지/);
    assert.equal(saved.has(key), false);
    assert.equal(element("shortShareButton").disabled, false);
  });
  await check("an expired saved password never reopens a blocking prompt", async () => {
    reset(); saved.set(key, "expired-test-token");
    context.fetch = async () => ({ok:false,status:401,json:async()=>({error:"expired"})});
    run("createShareLink()");
    for (let attempt=0; attempt<100 && element("shortShareButton").disabled; attempt+=1) await new Promise((resolve)=>setTimeout(resolve, 2));
    assert.match(element("settlementLinkInput").value, /#share=v2\./);
    assert.match(element("shortShareStatus").textContent, /올바르지/);
    assert.equal(saved.has(key), false);
    assert.equal(element("shortShareButton").disabled, false);
  });
  await check("successful short link encrypts the same snapshot and remembers only validated credentials", async () => {
    let body;
    context.fetch = async (_, options) => {
      body = JSON.parse(options.body);
      assert.equal(options.headers["X-Create-Token"], "valid-test-token");
      assert.ok(options.signal);
      return {ok:true,json:async()=>({id:"synthetic-share-id"})};
    };
    await run("createShortShareLink('valid-test-token')");
    const link = new URL(element("settlementLinkInput").value);
    const params = new URLSearchParams(link.hash.slice(1));
    assert.equal(params.get("s"), "synthetic-share-id");
    assert.equal(saved.get(key), "valid-test-token");
    context.encrypted = body;
    context.encodedKey = params.get("k");
    const decoded = await run("decryptRemoteShare(encrypted, encodedKey)");
    assert.equal(decoded.x[0][1], 1000);
    assert.equal(decoded.p.length, 2);
    assert.equal(JSON.stringify(body).includes("valid-test-token"), false);
  });
  await check("offline short-link service leaves the default link available", async () => {
    reset(); run("createShareLink()");
    const fallback = element("settlementLinkInput").value;
    context.fetch = async () => { throw new TypeError("offline"); };
    await run("createShortShareLink('test')");
    assert.equal(element("settlementLinkInput").value, fallback);
    assert.match(element("shortShareStatus").textContent, /연결하지 못/);
  });
  await check("hung short-link requests time out and restore the retry button", async () => {
    context.setTimeout = (fn) => setTimeout(fn, 10);
    context.fetch = (_, {signal}) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Object.assign(new Error("timeout"), {name:"AbortError"})), {once:true}));
    await run("createShortShareLink('test')");
    assert.match(element("shortShareStatus").textContent, /시간이 초과/);
    assert.equal(element("shortShareButton").disabled, false);
    context.setTimeout = setTimeout;
  });
  await check("credential storage errors do not block sharing", async () => {
    reset();
    const storage = context.localStorage;
    context.localStorage = {getItem(){throw new Error("blocked");},setItem(){throw new Error("quota");},removeItem(){throw new Error("blocked");}};
    run("createShareLink()");
    context.fetch = async () => ({ok:true,json:async()=>({id:"storage-blocked-test"})});
    await run("createShortShareLink('test')");
    assert.match(element("settlementLinkInput").value, /#s=storage-blocked-test/);
    context.localStorage = storage;
  });
  await check("switching trips discards a pending result and password field", async () => {
    reset(); run("createShareLink()");
    let resolveFetch;
    let started;
    const ready = new Promise((resolve) => { started = resolve; });
    context.fetch = () => new Promise((resolve) => { resolveFetch=resolve; started(); });
    const pending = run("createShortShareLink('test')");
    await ready;
    run("appState.trips=[createTrip('other')]; setActiveTrip(appState.trips[0].id);");
    const before = element("settlementLinkInput").value;
    resolveFetch({ok:true,json:async()=>({id:"stale-test"})});
    await pending;
    assert.equal(element("settlementLinkPanel").hidden, true);
    assert.equal(element("settlementLinkInput").value, before);
    assert.equal(saved.has(key), false);
  });
  await check("basic links also round-trip without the compression library", async () => {
    reset(); context.window.LZString = undefined;
    run("createShareLink()");
    context.location.hash = new URL(element("settlementLinkInput").value).hash;
    const restored = await run("readSharedState()");
    assert.equal(restored.tripName, "공유 테스트");
    assert.equal(restored.expenses[0].time, "12:30");
  });
  console.log(`${count} share checks passed`);
})().catch((error) => { console.error(error); process.exitCode=1; });
