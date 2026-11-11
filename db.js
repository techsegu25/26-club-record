// Firebase(Firestore) 연동 모듈
// - firebase-config.js는 텍스트로 읽어 firebaseConfig 값만 꺼내 씁니다.
//   (Firebase 콘솔 코드를 통째로 붙여넣어도 동작)
// - Firebase SDK는 필요할 때 불러오고, 실패하면 화면에 이유를 보여 줍니다.
const SDK = "https://www.gstatic.com/firebasejs/10.14.1";
let F = null; // { db, auth, fs, au }

async function readConfig() {
  let text;
  try {
    const res = await fetch("./firebase-config.js", { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    text = await res.text();
  } catch {
    throw new Error("firebase-config.js 파일을 찾을 수 없어요. 저장소에 파일이 있는지 확인해 주세요.");
  }
  const m = text.match(/\{[^{}]*apiKey[^{}]*\}/);
  if (!m) throw new Error("firebase-config.js에서 firebaseConfig 값을 찾지 못했어요.");
  let cfg;
  try { cfg = new Function(`return (${m[0]});`)(); }
  catch { throw new Error("firebase-config.js의 firebaseConfig 형식이 올바르지 않아요."); }
  if (!cfg.projectId || /붙여넣기/.test(cfg.apiKey || "")) {
    throw new Error("아직 Firebase 설정이 되지 않았어요. 선생님께 알려 주세요. (firebase-config.js)");
  }
  return cfg;
}

async function init() {
  if (F) return F;
  const cfg = await readConfig();
  let appMod, fs, au;
  try {
    [appMod, fs, au] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);
  } catch {
    throw new Error("Firebase에 연결하지 못했어요. 인터넷 연결을 확인하거나, 학교망에서 gstatic.com이 막혀 있는지 확인해 주세요.");
  }
  const app = appMod.initializeApp(cfg);
  F = { db: fs.getFirestore(app), auth: au.getAuth(app), fs, au };
  return F;
}

function withTimeout(p, ms = 15000) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(
      "Firebase 응답이 없어요. Firestore Database를 만들었는지, 인터넷 연결이 되는지 확인해 주세요.")), ms)),
  ]);
}

function friendly(e) {
  if (e?.code === "permission-denied") {
    return new Error("저장 권한이 없어요. 이 학번이 다른 이름으로 이미 등록되어 있을 수 있어요. 학번·이름을 확인하고, 문제가 있으면 선생님께 말씀드려 주세요.");
  }
  if (e?.code === "unavailable") return new Error("인터넷 연결을 확인하고 다시 시도해 주세요.");
  return e instanceof Error ? e : new Error(String(e));
}

const docId = (sid, name) => `${sid}_${name}`;

/* ---------- 학생 ---------- */
export async function loadMine(studentId, name) {
  const { db, fs } = await init();
  try {
    const snap = await withTimeout(fs.getDoc(fs.doc(db, "submissions", docId(studentId, name))));
    if (!snap.exists()) return [];
    const d = snap.data();
    const updatedAt = d.updatedAt?.toDate?.() || new Date(0);
    return Object.entries(d.entries || {}).map(([activity, e]) => ({ activity, ...e, updatedAt }));
  } catch (e) { throw friendly(e); }
}

export async function saveMine(studentId, name, entries) {
  const { db, fs } = await init();
  const map = {};
  for (const e of entries) {
    map[e.activity] = {
      roleTags: e.roleTags || [],
      role: e.role.trim(),
      learned: e.learned.trim(),
      detail: (e.detail || "").trim(),
      extra: e.extra || {},
    };
  }
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, "owners", studentId), { name });
  batch.set(fs.doc(db, "submissions", docId(studentId, name)), {
    studentId, name, entries: map, updatedAt: fs.serverTimestamp(),
  });
  try { await withTimeout(batch.commit()); } catch (e) { throw friendly(e); }
}

/* ---------- 교사 ---------- */
export async function watchTeacher(cb) {
  const { auth, au } = await init();
  return au.onAuthStateChanged(auth, cb);
}
export async function teacherSignIn() {
  const { auth, au } = await init();
  try { await au.signInWithPopup(auth, new au.GoogleAuthProvider()); }
  catch (e) {
    if (e?.code === "auth/unauthorized-domain") throw new Error("Firebase Authentication → 설정 → 승인된 도메인에 techsegu25.github.io를 추가해 주세요.");
    if (e?.code === "auth/operation-not-allowed") throw new Error("Firebase Authentication에서 Google 로그인을 사용 설정해 주세요.");
    if (e?.code === "auth/popup-closed-by-user") throw new Error("로그인 창이 닫혔어요. 다시 시도해 주세요.");
    throw e;
  }
}
export async function teacherSignOut() {
  const { auth, au } = await init();
  await au.signOut(auth);
}

// 관리자 화면용: 활동 하나당 한 줄로 펼쳐서 반환
export async function listAll() {
  const { db, fs } = await init();
  let snap;
  try { snap = await withTimeout(fs.getDocs(fs.collection(db, "submissions"))); }
  catch (e) {
    if (e?.code === "permission-denied") throw new Error("이 구글 계정에는 열람 권한이 없어요. Firestore 규칙에 선생님 이메일을 넣고 [게시]했는지 확인해 주세요.");
    throw e;
  }
  const rows = [];
  snap.forEach((s) => {
    const d = s.data();
    const updated = d.updatedAt?.toDate?.()?.toISOString() || "";
    for (const [activity, e] of Object.entries(d.entries || {})) {
      rows.push({
        doc_id: s.id, student_id: d.studentId, name: d.name, activity,
        role_tags: e.roleTags || [], role: e.role || "", learned: e.learned || "",
        detail: e.detail || "", extra: e.extra || {}, updated_at: updated,
      });
    }
  });
  rows.sort((a, b) => a.student_id.localeCompare(b.student_id));
  return rows;
}

export async function deleteStudent(studentId, name) {
  const { db, fs } = await init();
  const batch = fs.writeBatch(db);
  batch.delete(fs.doc(db, "submissions", docId(studentId, name)));
  batch.delete(fs.doc(db, "owners", studentId));
  await batch.commit();
}
