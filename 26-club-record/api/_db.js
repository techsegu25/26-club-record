import postgres from "postgres";

const url =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

let sql = null;
let ready = null;

export function getSql() {
  if (!url) {
    const err = new Error("DB가 연결되지 않았습니다. Vercel에서 Storage(Neon Postgres)를 연결해 주세요.");
    err.status = 503;
    throw err;
  }
  if (!sql) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    sql = postgres(url, { ssl: local ? false : "require", max: 1, prepare: false, idle_timeout: 20 });
  }
  if (!ready) {
    ready = sql`
      CREATE TABLE IF NOT EXISTS canopy_entries (
        student_id  text        NOT NULL,
        name        text        NOT NULL,
        activity    text        NOT NULL,
        role_tags   text[]      NOT NULL DEFAULT '{}',
        role        text        NOT NULL DEFAULT '',
        learned     text        NOT NULL DEFAULT '',
        detail      text        NOT NULL DEFAULT '',
        extra       jsonb       NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (student_id, activity)
      )`.catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready.then(() => sql);
}

export function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export function fail(res, e) {
  console.error(e);
  send(res, e.status || 500, { error: e.status ? e.message : "서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요." });
}

export function cleanId(v) {
  return String(v ?? "").replace(/\D/g, "").slice(0, 6);
}
export function cleanName(v) {
  return String(v ?? "").replace(/\s+/g, "").slice(0, 20);
}
export function cleanText(v, max = 2000) {
  return String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
}
