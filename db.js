// Firebase(Firestore) 연동 모듈
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, collection, writeBatch, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !!firebaseConfig.projectId && !/붙여넣기/.test(firebaseConfig.apiKey);

let app, db, auth;
function init() {
  if (!configured) throw new Error("아직 Firebase 설정이 되지 않았어요. 선생님께 알려 주세요. (firebase-config.js)");
  if (!app) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
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
  init();
  try {
    const snap = await getDoc(doc(db, "submissions", docId(studentId, name)));
    if (!snap.exists()) return [];
    const d = snap.data();
    const updatedAt = d.updatedAt?.toDate?.() || new Date(0);
    return Object.entries(d.entries || {}).map(([activity, e]) => ({ activity, ...e, updatedAt }));
  } catch (e) { throw friendly(e); }
}

export async function saveMine(studentId, name, entries) {
  init();
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
  const batch = writeBatch(db);
  batch.set(doc(db, "owners", studentId), { name });
  batch.set(doc(db, "submissions", docId(studentId, name)), {
    studentId, name, entries: map, updatedAt: serverTimestamp(),
  });
  try { await batch.commit(); } catch (e) { throw friendly(e); }
}

/* ---------- 교사 ---------- */
export function watchTeacher(cb) {
  init();
  return onAuthStateChanged(auth, cb);
}
export async function teacherSignIn() {
  init();
  await signInWithPopup(auth, new GoogleAuthProvider());
}
export async function teacherSignOut() {
  init();
  await signOut(auth);
}

// 관리자 화면용: 활동 하나당 한 줄로 펼쳐서 반환
export async function listAll() {
  init();
  let snap;
  try { snap = await getDocs(collection(db, "submissions")); }
  catch (e) {
    if (e?.code === "permission-denied") throw new Error("이 구글 계정에는 열람 권한이 없어요. Firestore 규칙(firestore.rules)에 선생님 이메일을 넣었는지 확인해 주세요.");
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
  init();
  const batch = writeBatch(db);
  batch.delete(doc(db, "submissions", docId(studentId, name)));
  batch.delete(doc(db, "owners", studentId));
  await batch.commit();
}
