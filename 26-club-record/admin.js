import { ACTIVITIES } from "/lib/activities.js";

const $ = (s, el = document) => el.querySelector(s);
const ACT = Object.fromEntries(ACTIVITIES.map((a) => [a.key, a]));
let key = "";
let rows = [];

try { key = sessionStorage.getItem("canopy-admin") || ""; } catch {}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (d) => new Date(d).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

for (const a of ACTIVITIES) $("#filter").insertAdjacentHTML("beforeend", `<option value="${a.key}">${a.badge} · ${a.title}</option>`);

async function load() {
  const res = await fetch("/api/admin", { headers: { "x-admin-key": key } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "불러오지 못했어요.");
  rows = body.rows;
  render();
}

$("#lock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  key = $("#pw").value;
  try {
    await load();
    try { sessionStorage.setItem("canopy-admin", key); } catch {}
    $("#lock").classList.add("hidden");
    $("#board").classList.remove("hidden");
  } catch (err) {
    const m = $("#lock-msg"); m.textContent = err.message; m.classList.remove("hidden");
  }
});

if (key) load().then(() => { $("#lock").classList.add("hidden"); $("#board").classList.remove("hidden"); }).catch(() => {});

function filtered() {
  const q = $("#q").value.trim().toLowerCase();
  const f = $("#filter").value;
  return rows.filter((r) =>
    (!f || r.activity === f) &&
    (!q || [r.student_id, r.name, r.role, r.learned, r.detail, (r.role_tags || []).join(" "), r.extra?.device].join(" ").toLowerCase().includes(q)));
}

function render() {
  const list = filtered();
  const students = new Map();
  for (const r of list) {
    if (!students.has(r.student_id)) students.set(r.student_id, { name: r.name, items: [] });
    students.get(r.student_id).items.push(r);
  }
  const allStudents = new Set(rows.map((r) => r.student_id)).size;
  $("#stats").innerHTML =
    `<div class="stat"><b>${allStudents}</b><span>제출한 학생</span></div>` +
    ACTIVITIES.map((a) => `<div class="stat"><b>${rows.filter((r) => r.activity === a.key).length}</b><span>${a.title}</span></div>`).join("");

  const order = ACTIVITIES.map((a) => a.key);
  $("#list").innerHTML = students.size === 0 ? `<div class="card" style="text-align:center;color:var(--muted)">아직 제출된 기록이 없어요.</div>` :
    [...students].map(([id, s]) => {
      s.items.sort((a, b) => order.indexOf(a.activity) - order.indexOf(b.activity));
      const last = s.items.reduce((m, r) => (r.updated_at > m ? r.updated_at : m), "");
      return `<details class="student">
        <summary><b>${esc(id)} ${esc(s.name)}</b><span style="color:var(--muted);font-size:13px">최근 ${fmt(last)}</span>
          <span class="acts">${s.items.map((r) => `<span class="badge">${esc(ACT[r.activity]?.badge || r.activity)}</span>`).join("")}</span></summary>
        <div class="body">
          ${s.items.map((r) => {
            const a = ACT[r.activity] || { title: r.activity, badge: "" };
            const ex = r.extra || {};
            return `<div class="entry"><h4><span class="badge">${esc(a.badge)}</span>${esc(a.title)}</h4><dl>
              ${ex.team ? `<dt>조 / 장치</dt><dd>${esc(ex.team)}조 · ${esc(ex.device)}</dd>` : ""}
              ${r.role_tags?.length ? `<dt>역할 태그</dt><dd>${esc(r.role_tags.join(", "))}</dd>` : ""}
              <dt>역할</dt><dd>${esc(r.role)}</dd>
              <dt>배운 점</dt><dd>${esc(r.learned)}</dd>
              ${r.detail ? `<dt>어려움·장면</dt><dd>${esc(r.detail)}</dd>` : ""}
            </dl></div>`;
          }).join("")}
          <div style="text-align:right;margin-top:6px"><button class="btn ghost small" data-del="${esc(id)}" data-name="${esc(s.name)}">이 학생 기록 삭제</button></div>
        </div></details>`;
    }).join("");
}

$("#list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  const typed = window.prompt(`${b.dataset.del} ${b.dataset.name} 학생의 기록을 모두 삭제합니다.\n확인하려면 학번을 입력하세요.`);
  if (typed !== b.dataset.del) return;
  await fetch(`/api/admin?studentId=${b.dataset.del}`, { method: "DELETE", headers: { "x-admin-key": key } });
  load();
});

$("#q").addEventListener("input", render);
$("#filter").addEventListener("change", render);
$("#reload").addEventListener("click", () => load().catch((e) => alert(e.message)));

$("#csv").addEventListener("click", () => {
  const head = ["학번", "이름", "구분", "활동", "조", "장치(주제)", "역할 태그", "내가 한 역할", "배운 점·느낀 점", "어려웠던 점·기억에 남는 장면", "최종 수정"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(cell).join(",")];
  const order = ACTIVITIES.map((a) => a.key);
  const list = filtered().slice().sort((a, b) => a.student_id.localeCompare(b.student_id) || order.indexOf(a.activity) - order.indexOf(b.activity));
  for (const r of list) {
    const a = ACT[r.activity] || { title: r.activity, badge: "" };
    const ex = r.extra || {};
    lines.push([r.student_id, r.name, a.badge, a.title, ex.team ? `${ex.team}조` : "", ex.device || "", (r.role_tags || []).join(", "), r.role, r.learned, r.detail, new Date(r.updated_at).toLocaleString("ko-KR")].map(cell).join(","));
  }
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: `CANOPY_활동기록_${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
