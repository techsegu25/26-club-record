import { getSql, send, fail, cleanId } from "./_db.js";
import { timingSafeEqual } from "node:crypto";

function authorized(req) {
  const pass = process.env.ADMIN_PASSWORD || "";
  const given = String(req.headers["x-admin-key"] || "");
  if (!pass) return null;
  const a = Buffer.from(pass);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET    /api/admin                      → 전체 제출 목록
// DELETE /api/admin?studentId=10101      → 학생 기록 전체 삭제
export default async function handler(req, res) {
  try {
    const ok = authorized(req);
    if (ok === null) return send(res, 503, { error: "Vercel 환경변수 ADMIN_PASSWORD가 설정되지 않았어요." });
    if (!ok) return send(res, 401, { error: "비밀번호가 올바르지 않아요." });

    const sql = await getSql();
    if (req.method === "GET") {
      const rows = await sql`
        SELECT student_id, name, activity, role_tags, role, learned, detail, extra, created_at, updated_at
        FROM canopy_entries ORDER BY student_id, activity`;
      return send(res, 200, { rows });
    }
    if (req.method === "DELETE") {
      const studentId = cleanId(req.query.studentId);
      if (!studentId) return send(res, 400, { error: "학번이 필요해요." });
      const r = await sql`DELETE FROM canopy_entries WHERE student_id = ${studentId}`;
      return send(res, 200, { ok: true, deleted: r.count });
    }
    res.setHeader("Allow", "GET, DELETE");
    return send(res, 405, { error: "허용되지 않은 요청입니다." });
  } catch (e) {
    return fail(res, e);
  }
}
