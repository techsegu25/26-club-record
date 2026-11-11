import { ACTIVITIES, PROJECT_URL, TEAM_COUNT } from "/lib/activities.js";

const $ = (s, el = document) => el.querySelector(s);
const MIN = 10; // 서버 최소 글자수와 동일
const state = { studentId: "", name: "", selected: new Set(), data: {} };

const store = {
  key: () => `canopy-draft-${state.studentId}`,
  get() { try { return JSON.parse(localStorage.getItem(this.key()) || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem(this.key(), JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem(this.key()); } catch {} },
};

function show(id) {
  for (const s of ["step-login", "step-write", "step-done"]) $("#" + s).classList.toggle("hidden", s !== id);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function message(el, text, kind = "err") {
  el.textContent = text;
  el.className = `msg ${kind}` + (text ? "" : " hidden");
}
function emptyEntry() { return { roleTags: [], role: "", learned: "", detail: "", extra: {} }; }

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  let body = {};
  try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body.error || "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.");
  return body;
}

/* ---------- STEP 1 ---------- */
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const studentId = $("#studentId").value.replace(/\D/g, "");
  const name = $("#name").value.replace(/\s+/g, "");
  const msg = $("#login-msg");
  if (!/^\d{4,6}$/.test(studentId)) return message(msg, "학번을 숫자 4~6자리로 입력해 주세요. (예: 10101)");
  if (name.length < 2) return message(msg, "이름을 정확히 입력해 주세요.");
  message(msg, "");

  const btn = $("#login-btn");
  btn.disabled = true; btn.textContent = "불러오는 중…";
  try {
    const { entries } = await api(`/api/entries?studentId=${studentId}&name=${encodeURIComponent(name)}`);
    state.studentId = studentId;
    state.name = name;
    state.data = {};
    state.selected = new Set(ACTIVITIES.filter((a) => a.group === "required").map((a) => a.key));
    for (const en of entries) { state.data[en.activity] = en; state.selected.add(en.activity); }

    // 서버에 저장된 것보다 최근 임시저장이 있으면 복원
    const draft = store.get();
    let restored = false;
    if (draft && draft.name === name && (!entries.length || draft.savedAt > Math.max(...entries.map((x) => +new Date(x.updatedAt))))) {
      state.data = { ...state.data, ...draft.data };
      state.selected = new Set([...state.selected, ...draft.selected]);
      restored = true;
    }
    startWriting(entries.length > 0, restored);
  } catch (err) {
    message(msg, err.message);
  } finally {
    btn.disabled = false; btn.textContent = "시작하기";
  }
});

function startWriting(hasSaved, restored) {
  $("#who-name").textContent = state.name;
  $("#who-id").textContent = `(${state.studentId})`;
  renderChoices();
  renderForms();
  const note = $("#draft-note");
  note.textContent = restored
    ? "✏️ 이 기기에 임시 저장된 내용을 불러왔어요. 제출해야 선생님께 전달돼요."
    : hasSaved ? "✅ 이전에 제출한 내용을 불러왔어요. 수정 후 다시 제출하면 덮어써져요." : "작성 중인 내용은 이 기기에 임시 저장돼요.";
  message($("#submit-msg"), "");
  show("step-write");
}

$("#logout-btn").addEventListener("click", () => { location.reload(); });

/* ---------- STEP 2: 활동 선택 ---------- */
function renderChoices() {
  const box = $("#choices");
  box.innerHTML = "";
  const groups = [["required", "필수 활동"], ["optional", "체험 · 일반화 활동 (참여한 것 선택)"]];
  for (const [g, label] of groups) {
    const h = document.createElement("div");
    h.className = "group-label"; h.textContent = label;
    box.append(h);
    const list = document.createElement("div");
    list.className = "choices";
    for (const a of ACTIVITIES.filter((x) => x.group === g)) {
      const req = a.group === "required";
      const lab = document.createElement("label");
      lab.className = "choice" + (state.selected.has(a.key) ? " on" : "") + (req ? " locked" : "");
      lab.innerHTML = `<input type="checkbox" ${state.selected.has(a.key) ? "checked" : ""} ${req ? "disabled" : ""}/>
        <div><div class="t"><span class="badge ${req ? (a.key === "sem2_project" ? "sem2" : "req") : ""}">${a.badge}</span>${a.title}</div>
        <div class="d">${req ? "필수 작성" : a.context.split(/[.,]/)[0] + "…"}</div></div>`;
      const cb = $("input", lab);
      cb.addEventListener("change", () => {
        collect();
        cb.checked ? state.selected.add(a.key) : state.selected.delete(a.key);
        lab.classList.toggle("on", cb.checked);
        renderForms();
        saveDraft();
      });
      list.append(lab);
    }
    box.append(list);
  }
}

/* ---------- 활동별 작성 폼 ---------- */
function renderForms() {
  const box = $("#forms");
  box.innerHTML = "";
  for (const a of ACTIVITIES.filter((x) => state.selected.has(x.key))) {
    const d = state.data[a.key] || emptyEntry();
    const node = $("#tpl-act").content.firstElementChild.cloneNode(true);
    node.dataset.key = a.key;
    if (a.key === "sem2_project") node.classList.add("sem2");
    $(".act-title", node).innerHTML = `<span class="badge ${a.group === "required" ? (a.key === "sem2_project" ? "sem2" : "req") : ""}">${a.badge}</span>${a.title}`;
    $(".context", node).textContent = a.context;

    if (a.link) {
      const ex = d.extra || {};
      const teamOpts = Array.from({ length: TEAM_COUNT }, (_, i) => `<option value="${i + 1}" ${ex.team == i + 1 ? "selected" : ""}>${i + 1}조</option>`).join("");
      $(".slot-link", node).innerHTML = `
        <div class="project-link">
          <div class="ico">🏠</div>
          <div class="txt"><b>쿼카쌤의 스마트 IoT 하우스</b>먼저 프로젝트 사이트에 들어가 우리 조가 고른 장치를 확인하고 오세요.</div>
          <a class="btn small" href="${PROJECT_URL}" target="_blank" rel="noopener">사이트 열기 ↗</a>
        </div>
        <label class="check"><input type="checkbox" name="checkedSite" ${ex.checkedSite ? "checked" : ""}/> 프로젝트 사이트에서 우리 조 주제를 확인했어요</label>
        <div class="row">
          <label class="field"><span>우리 조<em>*</em></span>
            <select name="team" required><option value="">선택</option>${teamOpts}</select></label>
          <label class="field"><span>우리 조가 만든 장치(주제)<em>*</em></span>
            <input type="text" name="device" maxlength="100" placeholder="예: 자동 환기 창문, 스마트 화분" value="${escapeAttr(ex.device || "")}" required /></label>
        </div>`;
    }

    const tags = $(".tags", node);
    for (const t of a.roleTags) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tag"; b.textContent = t;
      b.setAttribute("aria-pressed", d.roleTags?.includes(t) ? "true" : "false");
      b.addEventListener("click", () => {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
        saveDraft();
      });
      tags.append(b);
    }

    for (const f of ["role", "learned", "detail"]) {
      const ta = $(`textarea[name=${f}]`, node);
      ta.value = d[f] || "";
      ta.placeholder = a[f + "Prompt"];
      const counter = ta.parentElement.querySelector(".counter");
      const upd = () => {
        if (!counter) return;
        const n = ta.value.trim().length;
        counter.textContent = n < MIN ? `${n}자 · 최소 ${MIN}자 이상` : `${n}자`;
        counter.classList.toggle("low", n < MIN);
      };
      ta.addEventListener("input", () => { upd(); saveDraftSoon(); });
      upd();
    }
    node.addEventListener("change", saveDraftSoon);
    box.append(node);
  }
}

function escapeAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

function collect() {
  for (const node of document.querySelectorAll("#forms .act")) {
    const key = node.dataset.key;
    const entry = {
      roleTags: [...node.querySelectorAll('.tag[aria-pressed="true"]')].map((b) => b.textContent),
      role: $("textarea[name=role]", node).value,
      learned: $("textarea[name=learned]", node).value,
      detail: $("textarea[name=detail]", node).value,
      extra: {},
    };
    if ($("select[name=team]", node)) {
      entry.extra = {
        team: $("select[name=team]", node).value,
        device: $("input[name=device]", node).value,
        checkedSite: $("input[name=checkedSite]", node).checked,
      };
    }
    state.data[key] = entry;
  }
}

let draftTimer;
function saveDraftSoon() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 500); }
function saveDraft() {
  collect();
  store.set({ name: state.name, selected: [...state.selected], data: state.data, savedAt: Date.now() });
}

/* ---------- 제출 ---------- */
$("#entries-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  collect();
  const msg = $("#submit-msg");
  const acts = ACTIVITIES.filter((a) => state.selected.has(a.key));

  for (const a of acts) {
    const d = state.data[a.key];
    const node = document.querySelector(`#forms .act[data-key="${a.key}"]`);
    const problem =
      a.link && !d.extra.checkedSite ? "프로젝트 사이트를 확인하고 체크해 주세요." :
      a.link && !d.extra.team ? "우리 조를 선택해 주세요." :
      a.link && !d.extra.device.trim() ? "우리 조가 만든 장치(주제)를 적어 주세요." :
      d.role.trim().length < MIN ? `내가 한 역할을 ${MIN}자 이상 적어 주세요.` :
      d.learned.trim().length < MIN ? `배운 점을 ${MIN}자 이상 적어 주세요.` : "";
    if (problem) {
      message(msg, `[${a.badge} ${a.title}] ${problem}`);
      node.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }
  message(msg, "");

  const btn = $("#submit-btn");
  btn.disabled = true; btn.textContent = "제출 중…";
  try {
    await api("/api/entries", {
      method: "POST",
      body: JSON.stringify({
        studentId: state.studentId,
        name: state.name,
        entries: acts.map((a) => ({ activity: a.key, ...state.data[a.key] })),
      }),
    });
    store.clear();
    $("#done-text").textContent = `${state.name}(${state.studentId}) 학생의 활동 ${acts.length}개가 선생님께 전달되었어요.`;
    $("#done-list").innerHTML = acts.map((a) => `<li><span class="badge">${a.badge}</span>${a.title}</li>`).join("");
    show("step-done");
  } catch (err) {
    message(msg, err.message);
  } finally {
    btn.disabled = false; btn.textContent = "제출하기";
  }
});

$("#edit-btn").addEventListener("click", () => { renderForms(); $("#draft-note").textContent = "수정 후 다시 제출하면 덮어써져요."; show("step-write"); });
$("#finish-btn").addEventListener("click", () => location.reload());
