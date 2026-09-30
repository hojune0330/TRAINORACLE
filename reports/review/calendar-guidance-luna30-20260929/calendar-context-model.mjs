// Planning model only. This module is not imported by the application.
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === value;
}

export function anchor(policy, today, records, planDates = []) {
  const dates = records.filter(r => r.accepted && !r.deleted && !r.demo && validDate(r.date))
    .map(r => r.date).filter(date => date <= today).sort();
  const plan = [...new Set(planDates.filter(validDate))].sort();
  if ((policy === "PLAN_CANDIDATE" || policy === "INTAKE_PREVIEW") && plan.length)
    return { date: plan[0], reason: "PLAN_START" };
  if (policy === "ACTIVE_PLAN" && plan.length) {
    if (today >= plan[0] && today <= plan.at(-1)) return { date: today, reason: "PLAN_TODAY" };
    if (today < plan[0]) return { date: plan[0], reason: "PLAN_START" };
    return { date: plan.at(-1), reason: "PLAN_END" };
  }
  if (policy === "JOURNAL" && dates.length) return { date: dates.at(-1), reason: "RECENT_RECORD" };
  return { date: today, reason: "EMPTY_TODAY" };
}

export function boot(owner = "synthetic-A", epoch = 1, policy = "JOURNAL") {
  return { owner, epoch, policy, today: "2026-09-29", records: [], planDates: [],
    status: "LOADING", date: null, month: null, reason: null, locked: false,
    initialized: false, demo: false, demoContext: null, readerOpen: false, writes: 0, generation: -1 };
}

export function step(state, event, defects = {}) {
  const s = structuredClone(state);
  if (event.type === "ACCOUNT") return boot(event.owner, s.epoch + 1, s.policy);
  if (event.type === "READY" || event.type === "ERROR") {
    if (!defects.ignoreScope && (event.owner !== s.owner || event.epoch !== s.epoch)) return s;
    if (!defects.ignoreGeneration && (event.generation ?? 0) < s.generation) return s;
    s.generation = event.generation ?? 0;
    if (event.type === "ERROR" && !defects.errorIsEmpty) {
      s.status = s.records.length ? "STALE" : "ERROR";
      return s;
    }
    s.status = "READY";
    s.records = event.type === "ERROR" ? [] : event.records;
    s.planDates = event.planDates ?? s.planDates;
    if ((!s.initialized && !s.locked) || defects.refreshReanchors) {
      const next = anchor(s.policy, s.today, s.records, s.planDates);
      s.date = next.date;
      s.month = next.date.slice(0, 7);
      s.reason = next.reason;
      s.initialized = true;
    }
    return s;
  }
  if (event.type === "SELECT" || event.type === "EXPLICIT") {
    if (!validDate(event.date)) return s;
    s.date = event.date;
    s.month = event.date.slice(0, 7);
    s.locked = true;
    s.reason = event.type === "SELECT" ? "MANUAL" : "EXPLICIT";
    return s;
  }
  if (event.type === "MONTH") {
    if (!validDate(`${event.month}-01`)) return s;
    s.month = event.month;
    if (s.date?.slice(0, 7) !== s.month) s.date = null;
    s.locked = true;
    return s;
  }
  if (event.type === "MIDNIGHT") {
    if (validDate(event.today)) s.today = event.today;
    return s;
  }
  if (event.type === "RECENT" && s.status === "READY") {
    const next = anchor(s.policy, s.today, s.records, s.planDates);
    s.date = next.date;
    s.month = next.date.slice(0, 7);
    s.locked = true;
    s.reason = next.reason;
    return s;
  }
  if (event.type === "OPEN") {
    s.readerOpen = true;
    s.locked = true;
    return s;
  }
  if (event.type === "BACK") { s.readerOpen = false; return s; }
  if (event.type === "DEMO") {
    s.demo = s.status === "READY" && s.records.length === 0;
    if (s.demo) {
      s.demoContext = { date: s.today, month: s.today.slice(0, 7), fixture: "synthetic-example-v1" };
      s.locked = true;
    }
    return s;
  }
  if (event.type === "END_DEMO") { s.demo = false; s.demoContext = null; return s; }
  return s;
}
