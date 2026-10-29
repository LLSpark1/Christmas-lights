// Where the app keeps its data: Supabase when config.js is filled in, otherwise this browser (demo mode).
// Both stores have the same methods, so app.js doesn't care which one it is using.
(() => {
const cfg = window.LJE_CONFIG || {};
const redirect = location.origin + location.pathname;

function fail(error, fallback) {
  if (!error) return;
  const msg = error.message || fallback;
  throw new Error(msg);
}

function cloudStore(url, key) {
  const sb = window.supabase.createClient(url, key);
  return {
    mode: "cloud",
    async getUser() {
      const { data, error } = await sb.auth.getSession();
      fail(error, "Couldn't check your sign-in.");
      const u = data.session && data.session.user;
      return u ? { id: u.id, email: u.email } : null;
    },
    onAuth(cb) { sb.auth.onAuthStateChange(event => cb(event)); },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
      fail(error, "Couldn't create the account.");
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      fail(error, "Couldn't sign in.");
    },
    async signOut() { await sb.auth.signOut(); },
    async sendReset(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: redirect });
      fail(error, "Couldn't send the reset email.");
    },
    async setNewPassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      fail(error, "Couldn't change the password.");
    },
    async myCompany() {
      const user = await this.getUser();
      if (!user) return null;
      const { data, error } = await sb.from("memberships")
        .select("role, companies(id, name, settings)").eq("user_id", user.id).limit(1);
      fail(error, "Couldn't load your company.");
      const m = data && data[0];
      return m && m.companies ? { ...m.companies, role: m.role } : null;
    },
    async createCompany(name) {
      const { error } = await sb.rpc("create_company", { company_name: name });
      fail(error, "Couldn't create the company.");
      return this.myCompany();
    },
    async loadJobs(companyId) {
      const { data, error } = await sb.from("jobs").select("id, data").eq("company_id", companyId)
        .order("updated_at", { ascending: false }).limit(1000);
      fail(error, "Couldn't load jobs.");
      return data.map(r => ({ ...r.data, id: r.id }));
    },
    async saveJob(companyId, job) {
      const { error } = await sb.from("jobs").upsert({ id: job.id, company_id: companyId, data: job });
      fail(error, "Couldn't save the job.");
    },
    async deleteJob(companyId, id) {
      const { error } = await sb.from("jobs").delete().eq("id", id).eq("company_id", companyId);
      fail(error, "Couldn't delete the job.");
    },
    async saveSettings(companyId, settings) {
      const { error } = await sb.from("companies").update({ settings }).eq("id", companyId);
      fail(error, "Couldn't save your prices and suppliers.");
    },
  };
}

function demoStore() {
  const KEY = "lje-demo-v1";
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (e) { return {}; } };
  const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  return {
    mode: "demo",
    async getUser() { return { id: "demo", email: "" }; },
    onAuth() {},
    async myCompany() {
      const s = read();
      return { id: "demo", name: (s.settings && s.settings.bizName) || "Demo company", role: "owner", settings: s.settings || {} };
    },
    async loadJobs() { return Object.values(read().jobs || {}); },
    async saveJob(_, job) { const s = read(); (s.jobs = s.jobs || {})[job.id] = job; write(s); },
    async deleteJob(_, id) { const s = read(); if (s.jobs) delete s.jobs[id]; write(s); },
    async saveSettings(_, settings) { const s = read(); s.settings = settings; write(s); },
  };
}

const configured = cfg.supabaseUrl && cfg.supabaseAnonKey;
window.Store = configured && window.supabase ? cloudStore(cfg.supabaseUrl, cfg.supabaseAnonKey) : demoStore();
window.Store.problem = configured && !window.supabase
  ? "Couldn't load the sign-in system. Check your internet connection and reload."
  : "";
})();
