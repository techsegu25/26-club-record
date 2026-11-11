import { getSql, send, fail, cleanId, cleanName, cleanText } from "./_db.js";
import { ACTIVITIES, ACTIVITY_KEYS, REQUIRED_KEYS, TEAM_COUNT } from "../lib/activities.js";

// GET  /api/entries?studentId=10101&name=홍길동  → 내가 쓴 기록 불러오기
// POST /api/entries { studentId, name, entries: [...] } → 저장(덮어쓰기)
export default async function handler(req, res) {
  try {
    if (req.method === "GET") return await load(req, res);
    if (req.method === "POST") return await save(req, res);
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "허용되지 않은 요청입니다." });
  } catch (e) {
    return fail(res, e);
  }
}

function checkIdentity(studentId, name) {
  if (!/^\d{4,6}$/.test(studentId)) return "학번을 숫자 4~6자리로 입력해 주세요. (예: 10101)";
  if (name.length < 2) return "이름을 정확히 입력해 주세요.";
  return null;
}

async function load(req, res) {
  const studentId = cleanId(req.query.studentId);
  const name = cleanName(req.query.name);
  const bad = checkIdentity(studentId, name);
  if (bad) return send(res, 400, { error: bad });

  const sql = await getSql();
  const rows = await sql`
    SELECT activity, name, role_tags, role, learned, detail, extra, updated_at
    FROM canopy_entries WHERE student_id = ${studentId}`;

  if (rows.length && rows[0].name !== name) {
    return send(res, 409, {
      error: "이 학번은 다른 이름으로 이미 제출되어 있어요. 학번과 이름을 다시 확인하고, 문제가 있으면 선생님께 말씀드려 주세요.",
    });
  }
  return send(res, 200, {
    entries: rows.map((r) => ({
      activity: r.activity,
      roleTags: r.role_tags,
      role: r.role,
      learned: r.learned,
      detail: r.detail,
      extra: r.extra,
      updatedAt: r.updated_at,
    })),
  });
}

async function save(req, res) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const studentId = cleanId(body.studentId);
  const name = cleanName(body.name);
  const bad = checkIdentity(studentId, name);
  if (bad) return send(res, 400, { error: bad });

  const list = Array.isArray(body.entries) ? body.entries : [];
  const seen = new Set();
  const entries = [];
  for (const raw of list) {
    const key = String(raw?.activity || "");
    if (!ACTIVITY_KEYS.includes(key) || seen.has(key)) continue;
    seen.add(key);
    const act = ACTIVITIES.find((a) => a.key === key);
    const roleTags = (Array.isArray(raw.roleTags) ? raw.roleTags : [])
      .map((t) => cleanText(t, 40))
      .filter((t) => act.roleTags.includes(t));
    const role = cleanText(raw.role);
    const learned = cleanText(raw.learned);
    const detail = cleanText(raw.detail);
    if (role.length < 10 || learned.length < 10) {
      return send(res, 400, { error: `'${act.title}'의 역할과 배운 점을 각각 10자 이상 적어 주세요.` });
    }
    let extra = {};
    if (act.teamFields) {
      const team = parseInt(raw.extra?.team, 10);
      extra = {
        team: team >= 1 && team <= TEAM_COUNT ? team : null,
        device: cleanText(raw.extra?.device, 100),
        checkedSite: !!raw.extra?.checkedSite,
      };
    }
    entries.push({ key, roleTags, role, learned, detail, extra });
  }

  for (const k of REQUIRED_KEYS) {
    if (!seen.has(k)) {
      const act = ACTIVITIES.find((a) => a.key === k);
      return send(res, 400, { error: `필수 활동 '${act.badge} ${act.title}'을(를) 작성해 주세요.` });
    }
  }

  const sql = await getSql();
  const owner = await sql`SELECT name FROM canopy_entries WHERE student_id = ${studentId} LIMIT 1`;
  if (owner.length && owner[0].name !== name) {
    return send(res, 409, { error: "이 학번은 다른 이름으로 이미 제출되어 있어요. 선생님께 말씀드려 주세요." });
  }

  await sql.begin(async (tx) => {
    for (const e of entries) {
      await tx`
        INSERT INTO canopy_entries (student_id, name, activity, role_tags, role, learned, detail, extra)
        VALUES (${studentId}, ${name}, ${e.key}, ${e.roleTags}, ${e.role}, ${e.learned}, ${e.detail}, ${tx.json(e.extra)})
        ON CONFLICT (student_id, activity) DO UPDATE SET
          name = EXCLUDED.name, role_tags = EXCLUDED.role_tags, role = EXCLUDED.role,
          learned = EXCLUDED.learned, detail = EXCLUDED.detail, extra = EXCLUDED.extra,
          updated_at = now()`;
    }
    // 선택 해제한 활동은 삭제
    const keep = entries.map((e) => e.key);
    await tx`DELETE FROM canopy_entries WHERE student_id = ${studentId} AND NOT (activity = ANY(${keep}))`;
  });

  return send(res, 200, { ok: true, saved: entries.length });
}
