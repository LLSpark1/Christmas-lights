(() => {
// ---------- Lights ----------
const COLORS = ["Warm White", "Pure White", "Multicolor", "Red", "Green", "Blue"];
const TYPES = [
  { id: "c9", name: "C9 bulbs", kind: "bulb", wire: "SPT-2" },
  { id: "c7", name: "C7 bulbs", kind: "bulb", wire: "SPT-1" },
  { id: "mini", name: "Mini lights", kind: "mini" },
  { id: "net", name: "Net lights (bushes)", kind: "net" },
  { id: "rope", name: "Rope light", kind: "rope" },
];
const typeById = Object.fromEntries(TYPES.map(t => [t.id, t]));
const splitLight = v => { const [t, ...c] = String(v || "c9|Warm White").split("|"); return { t: typeById[t] || TYPES[0], color: c.join("|") || "Warm White" }; };
const unitOf = run => splitLight(run.light).t.kind === "net" ? "sq ft" : "ft";
// Reads "142", "142 ft", "1,200" or "20 x 30" (width × height, for bushes).
function parseLen(v) {
  const s = String(v ?? "").toLowerCase().replace(/,/g, "");
  const n = (s.match(/\d*\.?\d+/g) || []).map(Number);
  if (!n.length) return 0;
  return /[x×*]/.test(s) && n.length >= 2 ? n[0] * n[1] : n[0];
}

// What one spot needs: [{name, qty, unit, pack, packLabel}]
function needs(run) {
  const ft = Math.max(0, parseLen(run.feet));
  if (!ft) return [];
  const { t, color } = splitLight(run.light);
  if (t.kind === "bulb") {
    const bulbs = Math.ceil(ft) + 1;                // 12" spacing
    const wire = Math.ceil(ft * 1.05 + 3);          // 5% waste + lead
    return [
      { name: `${t.id.toUpperCase()} LED bulbs – ${color}`, qty: bulbs, unit: "bulbs", pack: 25, packLabel: "box of 25", cost: 20 },
      { name: `${t.wire} green wire, 12" spacing`, qty: wire, unit: "ft", pack: 1000, packLabel: "1,000 ft spool", cost: 220 },
      { name: "Gutter/shingle clips", qty: bulbs, unit: "clips", pack: 100, packLabel: "bag of 100", cost: 12 },
      { name: `${t.wire} zip plugs (male + female)`, qty: 2, unit: "plugs", pack: 10, packLabel: "bag of 10", cost: 8 },
    ];
  }
  if (t.kind === "mini") return [{ name: `LED mini lights, 70‑ct 24 ft – ${color}`, qty: Math.ceil(ft / 23), unit: "strings", pack: 1, packLabel: "", cost: 10 }];
  if (t.kind === "net") return [{ name: `LED net lights 4'×6' – ${color}`, qty: Math.ceil(ft / 24), unit: "nets", pack: 1, packLabel: "", cost: 22 }];
  if (t.kind === "rope") return [{ name: `LED rope light – ${color}`, qty: Math.ceil(ft * 1.05), unit: "ft", pack: 150, packLabel: "150 ft spool", cost: 110 }];
  return [];
}

// ---------- Quote ----------
// Starting prices for a new installer: lights + install + take-down, per foot (nets per sq ft).
const DEFAULT_RATES = { c9: 9, c7: 8, mini: 6, net: 3, rope: 8, min: 500, steep: 25, workers: 2, wage: 34, payroll: 20, comp: 13, overhead: 75 };
// Crew speed for the hour estimate: each worker hangs about 25 ft of line an hour; a net takes about 12 crew-minutes.
function autoHours(j) {
  const R = rates(), workers = Math.max(1, Number(R.workers) || 1);
  let ft = 0, nets = 0;
  for (const r of j.runs) { const n = parseLen(r.feet); if (unitOf(r) === "ft") ft += n; else nets += Math.ceil(n / 24); }
  if (!ft && !nets) return { install: 0, takedown: 0 };
  let install = ft / (25 * workers) + nets * 0.2;
  if (j.steep) install *= 1.25;
  install = Math.max(1, Math.ceil(install * 2) / 2);
  return { install, takedown: Math.max(0.5, Math.ceil(install) / 2) };
}
const DEFAULT_INCLUDED = "Commercial-grade LED lights, professional installation, free repairs during the season, and take-down after the holidays.";
const rates = () => ({ ...DEFAULT_RATES, ...(state.settings.rates || {}) });
const money = n => "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function quote(j) {
  const R = rates(), lines = [];
  for (const r of j.runs) {
    const ft = parseLen(r.feet); if (!ft) continue;
    const { t, color } = splitLight(r.light), rate = Number(R[t.id]) || 0;
    lines.push({ label: r.where || t.name, detail: `${fmt(ft)} ${unitOf(r)} of ${t.name.replace(" (bushes)", "")}, ${color} · ${money(rate)}/${unitOf(r)}`, amount: ft * rate });
  }
  const sub = lines.reduce((s, l) => s + l.amount, 0);
  const steep = j.steep ? sub * (Number(R.steep) || 0) / 100 : 0;
  let total = sub + steep;
  const minApplied = total > 0 && total < (Number(R.min) || 0);
  if (minApplied) total = Number(R.min);
  const cost = j.runs.flatMap(needs).reduce((s, it) => s + it.qty / it.pack * it.cost, 0);
  const auto = autoHours(j);
  const installHrs = j.installHrs !== "" && j.installHrs != null ? parseLen(j.installHrs) : auto.install;
  const takedownHrs = j.takedownHrs !== "" && j.takedownHrs != null ? parseLen(j.takedownHrs) : auto.takedown;
  const hours = installHrs + takedownHrs, workers = Number(R.workers) || 0, wage = Number(R.wage) || 0;
  const crewPay = workers * wage * hours;
  const burdenPct = (Number(R.payroll) || 0) + (Number(R.comp) || 0);
  const burden = crewPay * burdenPct / 100;
  const overhead = lines.length ? Number(R.overhead) || 0 : 0;
  const takeHome = total - cost - crewPay - burden - overhead;
  return { lines, sub, steep, total, minApplied, cost, profit: total - cost, steepPct: Number(R.steep) || 0, auto, hours, workers, wage, crewPay, burdenPct, burden, overhead, takeHome };
}
function quoteText(j) {
  const q = quote(j), biz = state.settings.bizName;
  const out = [`Christmas Lighting Quote${biz ? " – " + biz : ""}`, `Prepared for: ${j.customer || ""}`, `Address: ${j.address || ""}`, `Date: ${new Date().toLocaleDateString("en-US")}`, ""];
  for (const l of q.lines) out.push(`${l.label}: ${money(l.amount)}`);
  if (q.steep) out.push(`Two-story / steep roof: ${money(q.steep)}`);
  if (q.minApplied) out.push(`Minimum job price applies`);
  out.push("", `TOTAL: ${money(q.total)}`, "", `Includes: ${state.settings.included || DEFAULT_INCLUDED}`, "This quote is good for 30 days. Reply to this email to book your install date.");
  return out.join("\n");
}
function renderQuote() {
  const j = cur(), q = quote(j);
  $("steepPct").textContent = q.steepPct;
  const box = $("quoteLines"); box.replaceChildren();
  if (!q.lines.length) box.append(el("div", { class: "hint", text: "Your measurements turn into a price here." }));
  for (const l of q.lines) box.append(el("div", { class: "qline" }, el("span", {}, l.label, el("small", { text: l.detail })), el("span", { class: "amt", text: money(l.amount) })));
  const row = (k, v, cls) => el("div", { class: cls || "" }, el("span", { text: k }), el("span", { class: "amt", text: v }));
  const t = $("quoteTotals"); t.replaceChildren();
  if (q.steep) t.append(row(`Two-story / steep roof (+${q.steepPct}%)`, money(q.steep)));
  if (q.minApplied) t.append(row("Raised to your minimum job price", ""));
  t.append(row("Quote total", money(q.total), "grand"));
  const owner = isOwner();
  $("mine").hidden = !owner; $("hoursRow").hidden = !owner;
  $("installHrs").placeholder = q.auto.install ? q.auto.install + " (estimate)" : "Estimate";
  $("takedownHrs").placeholder = q.auto.takedown ? q.auto.takedown + " (estimate)" : "Estimate";
  $("mine").replaceChildren(el("span", { class: "k", text: "Only you see this" }),
    row("Customer pays", money(q.total)),
    row("Lights", "−" + money(q.cost)),
    row(`Crew pay (${q.workers} × ${q.hours} hrs × ${money(q.wage)})`, "−" + money(q.crewPay)),
    row(`Payroll taxes + workers' comp (${q.burdenPct}%)`, "−" + money(q.burden)),
    row("Gas, insurance & gear", "−" + money(q.overhead)),
    el("div", { class: "grand" }, el("span", { text: "You take home" }), el("span", { class: "amt " + (q.takeHome >= 0 ? "profit" : "loss"), text: money(q.takeHome) })),
    q.hours ? el("div", { class: "hint" }, el("span", { text: `That's ${money(q.takeHome / q.hours)} for every hour the crew is on site.` })) : null);
  $("quoteText").textContent = quoteText(j);
  $("emailQuote").href = `mailto:${encodeURIComponent(j.custEmail || "")}?subject=${encodeURIComponent("Your Christmas lighting quote")}&body=${encodeURIComponent(quoteText(j))}`;
}
function orderLines(job) {
  const m = new Map();
  for (const r of job.runs) for (const it of needs(r)) {
    if (!m.has(it.name)) m.set(it.name, { ...it, qty: 0 });
    m.get(it.name).qty += it.qty;
  }
  return [...m.values()].map(it => ({ ...it, packs: Math.ceil(it.qty / it.pack) }));
}

// ---------- State ----------
const Store = window.Store;
let company = null;   // { id, name, role, settings } of the signed-in user's company
const state = { jobs: {}, settings: { bizName: "", suppliers: [] }, currentId: null };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const newJobId = () => crypto.randomUUID ? crypto.randomUUID()
  : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const blankRun = () => ({ id: uid(), where: "", feet: "", light: "c9|Warm White" });
const blankJob = () => ({ id: newJobId(), address: "", runs: [blankRun()], supplier: "", orderedAt: null, updatedAt: Date.now() });
// Older saved jobs used a longer format; convert them on read.
const OLD = { c9s: "c9", c9f: "c9", c7s: "c7", c7f: "c7", m70: "mini", m100: "mini", net: "net", rope: "rope", stake: "c9" };
const AREA_NAMES = { roof: "Roofline", peak: "Peaks", ridge: "Ridge", window: "Windows", door: "Door", rail: "Railing", walk: "Walkway", trunk: "Tree trunk", bush: "Bushes" };
function normalize(j) {
  j.runs = (j.runs || []).map(r => r.light && r.light.includes("|") ? r :
    { id: r.id || uid(), where: r.where || AREA_NAMES[r.area] || "", feet: r.feet ?? r.amount ?? "", light: (OLD[r.light] || "c9") + "|" + (r.color || "Warm White") });
  return j;
}

const timers = {}, busy = {};
function saveJob(job) {
  job.updatedAt = Date.now();
  state.jobs[job.id] = job;
  clearTimeout(timers[job.id]);
  timers[job.id] = setTimeout(() => { delete timers[job.id]; writeJob(job.id); }, 700);
}
async function writeJob(id) {
  const job = state.jobs[id]; if (!job || !company) return;
  if (busy[id]) { busy[id].again = true; return; }
  busy[id] = { again: false };
  try { await Store.saveJob(company.id, JSON.parse(JSON.stringify(job))); }
  catch (e) { toast("Couldn't save. Check your connection."); }
  const again = busy[id].again; delete busy[id];
  if (again) writeJob(id);
}
let settingsTimer = null;
function saveSettings() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(async () => {
    try { await Store.saveSettings(company.id, JSON.parse(JSON.stringify(state.settings))); }
    catch (e) { toast(company.role === "owner" ? "Couldn't save your prices and suppliers." : "Only the company owner can change prices and suppliers."); }
  }, 700);
}

// ---------- Helpers ----------
const $ = id => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else if (v != null && v !== false) n.setAttribute(k, v);
  }
  for (const c of kids) if (c != null) n.append(c);
  return n;
};
const fmt = n => Number(n).toLocaleString("en-US");
const cur = () => state.jobs[state.currentId];
const supplierOf = j => (state.settings.suppliers || []).find(s => s.id === j.supplier);
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }

// ---------- Render ----------
function renderJobPick() {
  const s = $("jobPick"); s.replaceChildren();
  const jobs = Object.values(state.jobs).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const j of jobs) s.append(el("option", { value: j.id, text: (j.address || "New job") + (j.orderedAt ? "  ✓ ordered" : "") }));
  s.value = state.currentId;
}
function openJob(id) {
  state.currentId = id;
  const j = normalize(cur());
  $("address").value = j.address || "";
  $("custName").value = j.customer || "";
  $("custEmail").value = j.custEmail || "";
  $("steep").checked = !!j.steep;
  $("installHrs").value = j.installHrs || "";
  $("takedownHrs").value = j.takedownHrs || "";
  $("delAsk").hidden = true;
  updateMap(); renderRuns(); renderSuppliers(); renderOrder(); renderJobPick();
}
function updateMap() {
  const a = $("address").value.trim();
  $("mapBtn").href = a ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(a) : "https://www.google.com/maps";
}
function lightSelect(val) {
  const s = el("select", { "aria-label": "Light" });
  for (const t of TYPES) {
    const g = el("optgroup", { label: t.name });
    for (const c of COLORS) g.append(el("option", { value: t.id + "|" + c, text: t.name.replace(" (bushes)", "") + " – " + c }));
    s.append(g);
  }
  s.value = val; return s;
}
function renderRuns() {
  const j = cur(), box = $("runs"); box.replaceChildren();
  j.runs.forEach((run, i) => {
    const where = el("input", { value: run.where, placeholder: "e.g. Front roofline", "aria-label": "Where", id: "w-" + run.id });
    const feet = el("input", { type: "text", autocomplete: "off", value: run.feet, placeholder: unitOf(run) === "sq ft" ? "20 x 30" : "0", "aria-label": "Length", id: "f-" + run.id });
    const unit = el("span", { text: unitOf(run) });
    const light = lightSelect(run.light);
    where.addEventListener("input", () => { run.where = where.value; saveJob(j); renderOrder(); });
    feet.addEventListener("input", () => { run.feet = feet.value; saveJob(j); renderOrder(); });
    light.addEventListener("change", () => { run.light = light.value; unit.textContent = unitOf(run); feet.placeholder = unitOf(run) === "sq ft" ? "20 x 30" : "0"; saveJob(j); renderOrder(); });
    const del = el("button", { type: "button", class: "btn x", "aria-label": "Remove this spot", text: "×", onclick: () => { j.runs.splice(i, 1); if (!j.runs.length) j.runs.push(blankRun()); saveJob(j); renderRuns(); renderOrder(); } });
    box.append(el("div", { class: "run" }, el("div", { class: "where" }, where), el("div", { class: "ft" }, feet, unit), el("div", { class: "light" }, light), del));
  });
}
function renderSuppliers() {
  const s = $("supplier"), j = cur(), sups = state.settings.suppliers || [];
  s.replaceChildren();
  if (!sups.length) s.append(el("option", { value: "", text: "Add a supplier under “Prices & suppliers”" }));
  for (const sp of sups) s.append(el("option", { value: sp.id, text: "Order from: " + (sp.name || "Unnamed supplier") }));
  if (j && !sups.some(x => x.id === j.supplier) && sups[0]) j.supplier = sups[0].id;
  if (j) s.value = j.supplier || "";
}
function poText(j) {
  const sp = supplierOf(j), lines = orderLines(j);
  const out = [`Order from ${state.settings.bizName || "(your business)"}`, `Job: ${j.address || "(no address)"}`, ""];
  if (!lines.length) out.push("(no items yet)");
  for (const l of lines) out.push(`${l.packs} × ${l.packLabel ? l.packLabel + " " : ""}${l.name}`);
  out.push("", "Please confirm price and ship date. Thank you!");
  return out.join("\n");
}
function renderOrder() {
  const j = cur(); if (!j) return;
  const lines = orderLines(j), ul = $("order"); ul.replaceChildren();
  if (!lines.length) ul.append(el("li", { class: "hint", text: "Type in your measurements and the order fills in here." }));
  const prev = renderOrder.prev || {}, seen = {};
  const sameJob = renderOrder.job === j.id; renderOrder.job = j.id;
  for (const l of lines) seen[l.name] = l.qty;
  renderOrder.prev = seen;
  for (const l of lines) ul.append(el("li", { class: sameJob && prev[l.name] !== l.qty ? "changed" : "" },
    el("span", { class: "q", text: fmt(l.packs) + " ×" }),
    el("span", {}, (l.packLabel ? l.packLabel[0].toUpperCase() + l.packLabel.slice(1) + " – " : "") + l.name,
      l.pack > 1 ? el("div", { class: "need", text: `need ${fmt(l.qty)} ${l.unit}` }) : null)));
  const ft = j.runs.reduce((s, r) => s + (unitOf(r) === "ft" ? parseLen(r.feet) : 0), 0);
  $("totalFt").textContent = fmt(ft) + " ft";
  const sp = supplierOf(j), po = poText(j);
  $("poText").textContent = po;
  $("emailBtn").href = `mailto:${encodeURIComponent(sp?.email || "")}?subject=${encodeURIComponent("Light order – " + (j.address || "new job"))}&body=${encodeURIComponent(po)}`;
  const site = sp?.website ? (/^https?:\/\//.test(sp.website) ? sp.website : "https://" + sp.website) : "";
  $("siteBtn").hidden = !site; if (site) $("siteBtn").href = site;
  $("emailHint").textContent = sp ? (sp.email ? `Sends to ${sp.email}. If your email app doesn't open, use Copy order.` : `Add ${sp.name || "this supplier"}'s email under “Prices & suppliers” to send orders in one tap.`) : "";
  $("orderedNote").textContent = j.orderedAt ? "✓ Ordered " + new Date(j.orderedAt).toLocaleDateString("en-US") : "";
  renderQuote();
}
function renderSettings() {
  $("bizName").value = state.settings.bizName || "";
  const R = rates();
  for (const k of Object.keys(DEFAULT_RATES)) $("r-" + k).value = R[k];
  $("included").value = state.settings.included || DEFAULT_INCLUDED;
  const box = $("supList"); box.replaceChildren();
  if (!(state.settings.suppliers || []).length) box.append(el("div", { class: "hint", text: "No suppliers yet." }));
  (state.settings.suppliers || []).forEach((sp, i) => {
    const f = (k, ph, cls) => { const inp = el("input", { value: sp[k] || "", placeholder: ph, "aria-label": ph, id: `s-${sp.id}-${k}`, class: cls }); inp.addEventListener("input", () => { sp[k] = inp.value; saveSettings(); renderSuppliers(); renderOrder(); }); return inp; };
    box.append(el("div", { class: "sup" }, f("name", "Supplier name"), f("email", "Order email", "em"),
      el("button", { type: "button", class: "btn x", "aria-label": "Remove supplier", text: "×", onclick: () => { state.settings.suppliers.splice(i, 1); saveSettings(); renderSettings(); renderSuppliers(); renderOrder(); } })));
  });
  const owner = isOwner();
  $("readOnlyNote").hidden = owner;
  $("crewSettings").hidden = !owner;
  for (const c of $("settings").querySelectorAll("input, textarea, button")) if (c.id !== "closeSettings") c.disabled = !owner;
}

// ---------- Team (owner only) ----------
const isOwner = () => !company || company.role === "owner";
const inviteUrl = token => location.origin + location.pathname + "?invite=" + encodeURIComponent(token);
const shortDate = d => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function showInviteLink(token, label) {
  const url = inviteUrl(token), msg = `You're invited to join ${company.name} on Lights Job Estimator. Open this link to sign up: ${url}`;
  $("inviteLink").value = url;
  $("smsInvite").href = "sms:?&body=" + encodeURIComponent(msg);
  $("mailInvite").href = "mailto:?subject=" + encodeURIComponent("Join " + company.name) + "&body=" + encodeURIComponent(msg);
  $("inviteOut").hidden = false;
  $("inviteOut").dataset.label = label || "";
}
function copyText(text, input, done) {
  const fallback = () => { input.focus(); input.select(); toast("Selected – press copy on your device"); };
  try { navigator.clipboard.writeText(text).then(() => toast(done), fallback); } catch (e) { fallback(); }
}
async function renderTeam() {
  const ml = $("memberList"), il = $("inviteList");
  try {
    const [members, invites] = await Promise.all([Store.listMembers(company.id), Store.listInvites(company.id)]);
    ml.replaceChildren(...members.map(m => {
      const me = m.role === "owner";
      const acts = el("div", { class: "acts" });
      if (!me) {
        const rm = el("button", { type: "button", class: "btn link", text: "Remove" });
        rm.addEventListener("click", async () => {
          if (rm.dataset.armed !== "1") { rm.dataset.armed = "1"; rm.textContent = "Tap again to remove"; rm.style.color = "var(--berry)"; return; }
          try { await Store.removeMember(company.id, m.user_id); toast("Removed from your team"); } catch (e) { toast(friendly(e)); }
          renderTeam();
        });
        acts.append(rm);
      }
      return el("div", { class: "person" }, el("div", { class: "who" }, m.email || "Team member", el("small", { text: me ? "Owner" : "Crew · joined " + shortDate(m.created_at) })), acts);
    }));
    il.replaceChildren(...(invites.length ? invites.map(inv => el("div", { class: "person" },
      el("div", { class: "who" }, inv.label || "Unnamed invite", el("small", { text: "Link expires " + shortDate(inv.expires_at) })),
      el("div", { class: "acts" },
        el("button", { type: "button", class: "btn link", text: "Show link", onclick: () => showInviteLink(inv.token, inv.label) }),
        el("button", { type: "button", class: "btn link", text: "Cancel", onclick: async () => {
          try { await Store.cancelInvite(inv.token); toast("Invite cancelled"); } catch (e) { toast(friendly(e)); }
          $("inviteOut").hidden = true; renderTeam();
        } })))) : [el("div", { class: "hint", text: "No open invites." })]));
  } catch (e) { ml.replaceChildren(el("div", { class: "msg err", text: friendly(e) })); }
}
$("openTeam").addEventListener("click", () => { $("inviteOut").hidden = true; renderTeam(); $("team").showModal(); });
$("closeTeam").addEventListener("click", () => $("team").close());
$("makeInvite").addEventListener("click", async () => {
  const btn = $("makeInvite"); btn.disabled = true;
  try {
    const label = $("inviteLabel").value.trim();
    showInviteLink(await Store.createInvite(company.id, label), label);
    $("inviteLabel").value = ""; renderTeam();
  } catch (e) { toast(friendly(e)); }
  btn.disabled = false;
});
$("copyInvite").addEventListener("click", () => copyText($("inviteLink").value, $("inviteLink"), "Invite link copied"));

// An invite link (?invite=…) is remembered until the person signs in, even through email confirmation.
const INVITE_KEY = "lje-invite";
const pendingInvite = () => { try { return localStorage.getItem(INVITE_KEY) || ""; } catch (e) { return ""; } };
const setPendingInvite = t => { try { t ? localStorage.setItem(INVITE_KEY, t) : localStorage.removeItem(INVITE_KEY); } catch (e) {} };
const tokenFrom = text => { const m = String(text).match(/invite=([A-Za-z0-9]+)/); return m ? m[1] : String(text).trim().replace(/[^A-Za-z0-9]/g, ""); };
(() => {
  const t = new URLSearchParams(location.search).get("invite");
  if (t) { setPendingInvite(tokenFrom(t)); history.replaceState(null, "", location.pathname + location.hash); }
})();

// ---------- Events ----------
$("address").addEventListener("input", () => { const j = cur(); j.address = $("address").value; updateMap(); saveJob(j); renderOrder(); });
$("custName").addEventListener("input", () => { const j = cur(); j.customer = $("custName").value; saveJob(j); renderQuote(); });
$("custEmail").addEventListener("input", () => { const j = cur(); j.custEmail = $("custEmail").value; saveJob(j); renderQuote(); });
$("steep").addEventListener("change", () => { const j = cur(); j.steep = $("steep").checked; saveJob(j); renderQuote(); });
for (const k of ["installHrs", "takedownHrs"]) $(k).addEventListener("input", () => { const j = cur(); j[k] = $(k).value; saveJob(j); renderQuote(); });
$("copyQuote").addEventListener("click", () => {
  const text = quoteText(cur());
  const fallback = () => { const p = $("quoteText"); p.classList.remove("sr"); const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected – press copy on your device"); };
  try { navigator.clipboard.writeText(text).then(() => toast("Quote copied"), fallback); } catch (e) { fallback(); }
});
for (const k of Object.keys(DEFAULT_RATES)) $("r-" + k).addEventListener("input", () => {
  state.settings.rates = { ...rates(), [k]: $("r-" + k).value }; saveSettings(); renderQuote();
});
$("included").addEventListener("input", () => { state.settings.included = $("included").value; saveSettings(); renderQuote(); });
$("jobPick").addEventListener("change", () => openJob($("jobPick").value));
$("newJob").addEventListener("click", () => { const j = blankJob(); state.jobs[j.id] = j; openJob(j.id); $("address").focus(); });
$("addRun").addEventListener("click", () => { const j = cur(); const last = j.runs[j.runs.length - 1]; const r = blankRun(); if (last) r.light = last.light; j.runs.push(r); saveJob(j); renderRuns(); $("w-" + r.id).focus(); });
$("supplier").addEventListener("change", () => { const j = cur(); j.supplier = $("supplier").value; saveJob(j); renderOrder(); });
$("copyBtn").addEventListener("click", () => {
  const text = poText(cur());
  const fallback = () => { const p = $("poText"); p.classList.remove("sr"); const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Selected – press copy on your device"); };
  try { navigator.clipboard.writeText(text).then(() => toast("Order copied"), fallback); } catch (e) { fallback(); }
});
$("markOrdered").addEventListener("click", () => { const j = cur(); j.orderedAt = j.orderedAt ? null : Date.now(); saveJob(j); renderOrder(); renderJobPick(); });
$("delJob").addEventListener("click", () => $("delAsk").hidden = false);
$("delNo").addEventListener("click", () => $("delAsk").hidden = true);
$("delYes").addEventListener("click", async () => {
  const id = state.currentId; delete state.jobs[id]; clearTimeout(timers[id]); delete timers[id];
  try { await Store.deleteJob(company.id, id); toast("Job deleted"); }
  catch (e) { toast("Couldn't delete the job. Check your connection."); }
  bootWith();
});
$("openSettings").addEventListener("click", () => { renderSettings(); $("settings").showModal(); });
$("closeSettings").addEventListener("click", () => $("settings").close());
$("bizName").addEventListener("input", () => { state.settings.bizName = $("bizName").value; saveSettings(); renderOrder(); });
$("addSup").addEventListener("click", () => { (state.settings.suppliers = state.settings.suppliers || []).push({ id: uid(), name: "", email: "", website: "" }); saveSettings(); renderSettings(); renderSuppliers(); });

// ---------- Boot ----------
function bootWith() {
  const latest = Object.values(state.jobs).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  if (latest) openJob(latest.id); else { const j = blankJob(); state.jobs[j.id] = j; openJob(j.id); }
}
const VIEWS = ["loadingView", "problemView", "authView", "companyView", "resetView", "appView"];
function show(view) {
  for (const v of VIEWS) $(v).hidden = v !== view;
  $("account").hidden = view !== "appView";
}
function setMsg(id, text, kind) { const m = $(id); m.textContent = text || ""; m.className = "msg" + (kind ? " " + kind : ""); }
function showProblem(text) { $("problemText").textContent = text; show("problemView"); }

async function startApp(co) {
  company = co;
  state.settings = { bizName: co.name, suppliers: [], ...JSON.parse(JSON.stringify(co.settings || {})) };
  state.jobs = {};
  for (const j of await Store.loadJobs(co.id)) state.jobs[j.id] = normalize(j);
  $("companyName").textContent = co.name + (co.role === "owner" ? "" : " · crew");
  $("openTeam").hidden = !(Store.hasTeams && co.role === "owner");
  show("appView");
  bootWith();
}
async function enterCompany() {
  const co = await Store.myCompany(), invite = pendingInvite();
  if (invite && Store.hasTeams) {
    setPendingInvite("");
    if (co) toast("This account already belongs to a company, so the invite wasn't used.");
    else {
      try { const joined = await Store.acceptInvite(invite); toast("You joined " + joined.name); return startApp(joined); }
      catch (e) { show("companyView"); $("inviteCode").value = invite; setMsg("joinMsg", friendly(e), "err"); return; }
    }
  }
  if (!co) { show("companyView"); $("newCompany").focus(); return; }
  await startApp(co);
}

// Sign in, create account and forgot password share one form.
let authMode = "signin";
const AUTH_TEXT = {
  signin: { title: "Sign in", submit: "Sign in" },
  signup: { title: "Create your account", submit: "Create account" },
  forgot: { title: "Reset your password", submit: "Email me a reset link" },
};
function showAuth(mode, msg, kind) {
  authMode = mode;
  $("authTitle").textContent = AUTH_TEXT[mode].title;
  $("authSubmit").textContent = AUTH_TEXT[mode].submit;
  $("authPassWrap").hidden = mode === "forgot";
  $("authPass").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("toSignUp").hidden = mode !== "signin";
  $("toForgot").hidden = mode !== "signin";
  $("toSignIn").hidden = mode === "signin";
  setMsg("authMsg", msg, kind);
  $("inviteNote").hidden = !pendingInvite() || mode === "forgot";
  show("authView");
}
function friendly(e) {
  const m = (e && e.message) || "";
  if (/invalid login/i.test(m)) return "That email and password don't match. Try again, or reset your password.";
  if (/not confirmed/i.test(m)) return "Confirm your email first: open the link we sent you, then sign in.";
  if (/already registered|already been registered/i.test(m)) return "That email already has an account. Sign in instead.";
  if (/rate limit|too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/fetch|network/i.test(m)) return "Can't reach the server. Check your internet connection.";
  return m || "Something went wrong. Try again.";
}
$("toSignUp").addEventListener("click", () => showAuth("signup"));
$("toForgot").addEventListener("click", () => showAuth("forgot"));
$("toSignIn").addEventListener("click", () => showAuth("signin"));
$("authView").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("authEmail").value.trim(), pass = $("authPass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg("authMsg", "Enter your email address.", "err");
  if (authMode === "signup" && pass.length < 8) return setMsg("authMsg", "Use a password with at least 8 characters.", "err");
  if (authMode === "signin" && !pass) return setMsg("authMsg", "Enter your password.", "err");
  const btn = $("authSubmit"); btn.disabled = true; setMsg("authMsg", "One moment…");
  try {
    if (authMode === "signin") { await Store.signIn(email, pass); await enterCompany(); }
    else if (authMode === "signup") {
      const r = await Store.signUp(email, pass);
      if (r.needsConfirm) showAuth("signin", "Almost done: check your email for a confirmation link, then sign in here.", "ok");
      else await enterCompany();
    } else {
      await Store.sendReset(email);
      setMsg("authMsg", "If that email has an account, a reset link is on its way.", "ok");
    }
  } catch (err) { setMsg("authMsg", friendly(err), "err"); }
  btn.disabled = false;
});
async function joinWithCode() {
  const token = tokenFrom($("inviteCode").value);
  if (!token) return setMsg("joinMsg", "Paste the invite link you were sent.", "err");
  setMsg("joinMsg", "Joining…");
  try { const joined = await Store.acceptInvite(token); toast("You joined " + joined.name); await startApp(joined); }
  catch (err) { setMsg("joinMsg", friendly(err), "err"); }
}
$("joinCompany").addEventListener("click", joinWithCode);
$("companyView").addEventListener("submit", async e => {
  e.preventDefault();
  const name = $("newCompany").value.trim();
  if (!name && $("inviteCode").value.trim()) return joinWithCode();
  if (!name) return setMsg("companyMsg", "Enter your company name.", "err");
  setMsg("companyMsg", "Creating…");
  try { await startApp(await Store.createCompany(name)); }
  catch (err) { setMsg("companyMsg", friendly(err), "err"); }
});
let recovering = false;
$("resetView").addEventListener("submit", async e => {
  e.preventDefault();
  const pass = $("resetPass").value;
  if (pass.length < 8) return setMsg("resetMsg", "Use a password with at least 8 characters.", "err");
  try {
    await Store.setNewPassword(pass);
    recovering = false;
    history.replaceState(null, "", location.pathname);
    await enterCompany(); toast("Password changed");
  } catch (err) { setMsg("resetMsg", friendly(err), "err"); }
});
$("signOut").addEventListener("click", async () => { await Store.signOut(); location.reload(); });

// Pick up jobs the rest of the crew saved while this tab was in the background.
document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !company || Store.mode === "demo") return;
  try {
    const incoming = {};
    for (const j of await Store.loadJobs(company.id)) incoming[j.id] = normalize(j);
    // Keep this tab's copy of the open job and of anything still saving.
    for (const id of Object.keys(state.jobs)) if (id === state.currentId || timers[id] || busy[id]) incoming[id] = state.jobs[id];
    state.jobs = incoming; renderJobPick();
  } catch (e) {}
});

(async () => {
  if (Store.problem) return showProblem(Store.problem);
  $("demoBanner").hidden = Store.mode !== "demo";
  $("signOut").hidden = Store.mode === "demo";
  Store.onAuth(ev => {
    if (ev === "PASSWORD_RECOVERY") { recovering = true; show("resetView"); }
    else if (ev === "SIGNED_OUT" && company) location.reload();
  });
  try {
    const user = await Store.getUser();
    if (recovering) return;
    if (!user) return showAuth("signin");
    await enterCompany();
  } catch (e) { showProblem(friendly(e)); }
})();
})();
