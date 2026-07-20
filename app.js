const STORAGE_KEY = "controle-muaythai-alunos-v1";
const DRAFT_KEY = "controle-muaythai-alunos-draft-v1";
const OWNER_EMAIL = "vineleme@icloud.com";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const accessMode = new URLSearchParams(window.location.search).get("acesso") || "admin";
const supabaseConfig = window.SUPABASE_CONFIG || {};
const hasSupabaseConfig = Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase);
const db = hasSupabaseConfig ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey) : null;
const hasDraftOnLoad = Boolean(localStorage.getItem(DRAFT_KEY));
let isProfessorMode = accessMode === "professor";

const state = {
  students: loadStudents(),
  dirty: hasDraftOnLoad,
  user: null,
  role: isProfessorMode ? "professor" : "admin",
  filters: {
    search: "",
    status: "",
    turma: "",
    categoria: "",
    forma: "",
  },
};

const els = {
  app: document.querySelector(".app-shell"),
  loginView: document.querySelector("#loginView"),
  loginForm: document.querySelector("#loginForm"),
  loginEmail: document.querySelector("#loginEmail"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  rows: document.querySelector("#studentRows"),
  template: document.querySelector("#rowTemplate"),
  summary: document.querySelector(".summary-grid"),
  stickyPanel: document.querySelector(".sticky-panel"),
  tableWrap: document.querySelector(".table-wrap"),
  professorView: document.querySelector("#professorView"),
  search: document.querySelector("#searchInput"),
  searchPanel: document.querySelector("#searchPanel"),
  toggleSearch: document.querySelector("#toggleSearch"),
  status: document.querySelector("#statusFilter"),
  turma: document.querySelector("#classFilter"),
  categoria: document.querySelector("#categoryFilter"),
  forma: document.querySelector("#paymentFilter"),
  save: document.querySelector("#saveData"),
  add: document.querySelector("#addStudent"),
  addFab: document.querySelector("#addStudentFab"),
  accessBadge: document.querySelector("#accessBadge"),
  exportCsv: document.querySelector("#exportCsv"),
  reset: document.querySelector("#resetData"),
  logout: document.querySelector("#logout"),
  paidTotal: document.querySelector("#paidTotal"),
  paidCount: document.querySelector("#paidCount"),
  unpaidTotal: document.querySelector("#unpaidTotal"),
  unpaidCount: document.querySelector("#unpaidCount"),
  chargedTotal: document.querySelector("#chargedTotal"),
  chargedCount: document.querySelector("#chargedCount"),
  overdueTotal: document.querySelector("#overdueTotal"),
  overdueCount: document.querySelector("#overdueCount"),
};

function loadStudents() {
  const draft = localStorage.getItem(DRAFT_KEY);
  if (draft) {
    try {
      return normalizeStudents(JSON.parse(draft));
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeStudents(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return normalizeStudents(structuredClone(window.INITIAL_STUDENTS || []));
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
  localStorage.removeItem(DRAFT_KEY);
  state.dirty = false;
  applyAccessMode();
}

async function persistStudents() {
  if (!hasSupabaseConfig) {
    saveStudents();
    return;
  }
  const rows = state.students.map(toDbRow);
  const { error } = await db.from("students").upsert(rows, { onConflict: "id" });
  if (error) {
    alert(`Não consegui salvar no banco: ${error.message}`);
    return;
  }
  saveStudents();
}

function normalizeStudents(students) {
  return students.map((student) => {
    if (student.turma === "Muay Thai 19:00:00") {
      return { ...student, horario: "19:00", turma: "Muay Thai 19:00" };
    }
    return student;
  });
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function statusOf(student) {
  if (student.pago === "Sim") return "Pago";
  if (student.cobrado === "Sim") return "Cobrado";
  return "Inadimplente";
}

function rowClass(status) {
  return `status-${normalize(status)}`;
}

function visibleStudents() {
  const query = normalize(state.filters.search);
  return state.students.filter((student) => {
    const status = statusOf(student);
    const text = normalize(`${student.aluno} ${student.turma} ${student.observacao}`);
    return (
      (!query || text.includes(query)) &&
      (!state.filters.status || status === state.filters.status) &&
      (!state.filters.turma || student.turma === state.filters.turma) &&
      (!state.filters.categoria || student.categoria === state.filters.categoria) &&
      (!state.filters.forma || student.forma === state.filters.forma)
    );
  });
}

function updateClassFilter() {
  const current = els.turma.value;
  const classes = [...new Set(state.students.map((student) => student.turma).filter(Boolean))].sort();
  els.turma.innerHTML = '<option value="">Todas</option>';
  for (const turma of classes) {
    const option = document.createElement("option");
    option.value = turma;
    option.textContent = turma;
    els.turma.append(option);
  }
  els.turma.value = classes.includes(current) ? current : "";
  state.filters.turma = els.turma.value;
}

function render() {
  applyAccessMode();
  updateClassFilter();
  const students = visibleStudents();
  els.rows.replaceChildren();
  renderProfessorView(students);

  for (const student of students) {
    const row = els.template.content.firstElementChild.cloneNode(true);
    const status = statusOf(student);
    row.dataset.id = student.id;
    row.classList.add(rowClass(status));
    if (student.isNew) {
      row.classList.add("highlight-new");
    }

    for (const input of row.querySelectorAll("[data-field]")) {
      const field = input.dataset.field;
      input.value = field === "valor" ? String(student.valor || "") : student[field] || "";
      applyFieldPermission(input, student, field);
      input.addEventListener("input", () => updateStudent(student.id, field, input.value));
      input.addEventListener("change", () => updateStudent(student.id, field, input.value));
    }

    const pill = row.querySelector(".status-pill");
    pill.textContent = status;
    pill.className = `status-pill ${rowClass(status).replace("status-", "")}`;

    const deleteButton = row.querySelector(".delete-row");
    deleteButton.textContent = isProfessorMode ? "Pedir remoção" : "Remover";
    deleteButton.addEventListener("click", () => handleDelete(student));

    els.rows.append(row);
  }

  renderSummary(students);
}

function applyAccessMode() {
  document.body.classList.toggle("professor-mode", isProfessorMode);
  els.app.hidden = hasSupabaseConfig && !state.user;
  els.loginView.hidden = !hasSupabaseConfig || Boolean(state.user);
  els.accessBadge.textContent = isProfessorMode ? "Acesso professor: consulta de pagamento." : saveStatusText();
  els.summary.hidden = isProfessorMode;
  els.tableWrap.hidden = isProfessorMode;
  els.professorView.hidden = !isProfessorMode;
  els.save.hidden = isProfessorMode;
  els.add.hidden = isProfessorMode;
  els.addFab.hidden = isProfessorMode;
  els.exportCsv.hidden = isProfessorMode;
  els.reset.hidden = isProfessorMode;
  els.logout.hidden = !hasSupabaseConfig || !state.user;
}

function applyFieldPermission(input, student, field) {
  if (!isProfessorMode) return;
  const canEditNewStudent = student.createdBy === "professor";
  const allowedFields = ["aluno", "categoria", "turma", "observacao"];
  input.disabled = !canEditNewStudent || !allowedFields.includes(field);
}

function renderSummary(students) {
  const buckets = {
    Pago: { count: 0, total: 0 },
    Cobrado: { count: 0, total: 0 },
    Inadimplente: { count: 0, total: 0 },
  };

  for (const student of students) {
    const status = statusOf(student);
    buckets[status].count += 1;
    buckets[status].total += Number(student.valor || 0);
  }

  const unpaid = {
    count: buckets.Cobrado.count + buckets.Inadimplente.count,
    total: buckets.Cobrado.total + buckets.Inadimplente.total,
  };

  els.paidTotal.textContent = money.format(buckets.Pago.total);
  els.paidCount.textContent = `${buckets.Pago.count} alunos`;
  els.unpaidTotal.textContent = money.format(unpaid.total);
  els.unpaidCount.textContent = `${unpaid.count} alunos`;
  els.chargedTotal.textContent = money.format(buckets.Cobrado.total);
  els.chargedCount.textContent = `${buckets.Cobrado.count} alunos`;
  els.overdueTotal.textContent = money.format(buckets.Inadimplente.total);
  els.overdueCount.textContent = `${buckets.Inadimplente.count} alunos`;
}

function renderProfessorView(students) {
  els.professorView.replaceChildren();
  for (const student of students) {
    const item = document.createElement("article");
    const status = statusOf(student);
    item.className = `professor-card ${rowClass(status)}`;
    item.innerHTML = `
      <strong>${escapeHtml(student.aluno || "Sem nome")}</strong>
      <span>${escapeHtml(status)}</span>
      <small>${escapeHtml(student.categoria || "")}</small>
      <b>${money.format(Number(student.valor || 0))}</b>
    `;
    els.professorView.append(item);
  }
}

function updateStudent(id, field, rawValue) {
  const student = state.students.find((item) => item.id === id);
  if (!student) return;
  if (isProfessorMode) {
    const allowedFields = ["aluno", "categoria", "turma", "observacao"];
    if (student.createdBy !== "professor" || !allowedFields.includes(field)) return;
  }
  student[field] = field === "valor" ? Number(String(rawValue).replace(",", ".")) || 0 : rawValue;
  if (field === "turma") {
    const [modalidade, horario] = splitClass(rawValue);
    student.modalidade = modalidade;
    student.horario = horario;
  }
  markDirty();
  render();
}

function markDirty() {
  state.dirty = true;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.students));
  applyAccessMode();
}

function saveStatusText() {
  if (state.dirty) return "Alterações pendentes. Clique em Salvar alterações.";
  return "Tudo salvo.";
}

function splitClass(turma) {
  if (turma.startsWith("Boxe")) return ["Boxe", turma.replace("Boxe ", "")];
  return ["Muay Thai", turma.replace("Muay Thai ", "")];
}

function addStudent() {
  const newStudent = {
    id: `aluno-${Date.now()}`,
    aluno: "Novo aluno",
    modalidade: "Muay Thai",
    horario: "19:00",
    turma: "Muay Thai 19:00",
    cobrado: "Nao",
    pago: "Nao",
    valor: 0,
    forma: "Pix/Outros",
    categoria: "Mensal",
    observacao: "",
    isNew: true,
    createdBy: isProfessorMode ? "professor" : "admin",
  };
  state.students.push(newStudent);
  clearFilters();
  markDirty();
  render();
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-id="${newStudent.id}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.querySelector('[data-field="aluno"]')?.focus();
    delete newStudent.isNew;
    markDirty();
  });
}

function handleDelete(student) {
  if (isProfessorMode) {
    requestRemoval(student);
    return;
  }
  state.students = state.students.filter((item) => item.id !== student.id);
  markDirty();
  render();
}

function requestRemoval(student) {
  const subject = encodeURIComponent("Autorização para remover aluno");
  const body = encodeURIComponent(
    [
      "Olá, Vinicius.",
      "",
      "Solicito autorização para remover este aluno do controle:",
      `Aluno: ${student.aluno || "Sem nome"}`,
      `Turma: ${student.turma || ""}`,
      `Categoria: ${student.categoria || ""}`,
      `Valor: ${money.format(Number(student.valor || 0))}`,
      "",
      "Aguardo sua confirmação.",
    ].join("\n")
  );
  window.location.href = `mailto:${OWNER_EMAIL}?subject=${subject}&body=${body}`;
}

function clearFilters() {
  state.filters.search = "";
  state.filters.status = "";
  state.filters.turma = "";
  state.filters.categoria = "";
  state.filters.forma = "";
  els.search.value = "";
  els.status.value = "";
  els.turma.value = "";
  els.categoria.value = "";
  els.forma.value = "";
}

function toggleSearchPanel() {
  const isHidden = els.searchPanel.hidden;
  els.searchPanel.hidden = !isHidden;
  els.toggleSearch.setAttribute("aria-expanded", String(isHidden));
  if (isHidden) {
    requestAnimationFrame(() => els.search.focus());
  }
}

function exportCsv() {
  const headers = ["Aluno", "Cobrado", "Pago", "Status", "Categoria", "Turma", "Valor", "Forma", "Observacao"];
  const rows = visibleStudents().map((student) => [
    student.aluno,
    student.cobrado,
    student.pago,
    statusOf(student),
    student.categoria,
    student.turma,
    String(student.valor || 0).replace(".", ","),
    student.forma,
    student.observacao,
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell || "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "controle-muaythai-boxe.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function resetData() {
  const confirmed = confirm("Restaurar os dados iniciais da planilha? As alterações feitas no app serão apagadas.");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(DRAFT_KEY);
  state.students = structuredClone(window.INITIAL_STUDENTS || []);
  state.dirty = true;
  render();
}

async function loadSession() {
  if (!hasSupabaseConfig) return;
  const { data } = await db.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user) {
    await loadRole();
    await loadStudentsFromDb();
  }
  render();
}

async function loadRole() {
  const { data, error } = await db.from("profiles").select("role").eq("user_id", state.user.id).single();
  if (error) {
    state.role = "professor";
  } else {
    state.role = data.role || "professor";
  }
  isProfessorMode = state.role === "professor";
}

async function loadStudentsFromDb() {
  const request = isProfessorMode
    ? db.rpc("get_professor_students")
    : db.from("students").select("*").order("aluno", { ascending: true });
  const { data, error } = await request;
  if (error) {
    alert(`Não consegui carregar o banco: ${error.message}`);
    return;
  }
  if (!isProfessorMode && (!data || data.length === 0)) {
    state.students = normalizeStudents(structuredClone(window.INITIAL_STUDENTS || []));
    state.dirty = true;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(state.students));
    return;
  }
  state.students = normalizeStudents((data || []).map(fromDbRow));
  saveStudents();
}

async function login(event) {
  event.preventDefault();
  els.loginMessage.textContent = "Entrando...";
  const { data, error } = await db.auth.signInWithPassword({
    email: els.loginEmail.value,
    password: els.loginPassword.value,
  });
  if (error) {
    els.loginMessage.textContent = "E-mail ou senha inválidos.";
    return;
  }
  state.user = data.user;
  await loadRole();
  await loadStudentsFromDb();
  els.loginMessage.textContent = "";
  render();
}

async function logout() {
  if (hasSupabaseConfig) await db.auth.signOut();
  state.user = null;
  render();
}

function toDbRow(student) {
  return {
    id: student.id,
    aluno: student.aluno || "",
    modalidade: student.modalidade || "Muay Thai",
    horario: student.horario || "19:00",
    turma: student.turma || "Muay Thai 19:00",
    cobrado: student.cobrado || "Nao",
    pago: student.pago || "Nao",
    valor: Number(student.valor || 0),
    forma: student.forma || "Pix/Outros",
    categoria: student.categoria || "Mensal",
    observacao: student.observacao || "",
    created_by: student.createdBy || "admin",
    updated_at: new Date().toISOString(),
  };
}

function fromDbRow(row) {
  return {
    id: row.id,
    aluno: row.aluno,
    modalidade: row.modalidade || "Muay Thai",
    horario: row.horario || "",
    turma: row.turma,
    cobrado: row.cobrado || "Nao",
    pago: row.pago,
    valor: Number(row.valor || 0),
    forma: row.forma || "",
    categoria: row.categoria,
    observacao: row.observacao || "",
    createdBy: row.created_by || "admin",
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wireFilters() {
  const bindings = [
    [els.search, "search", "input"],
    [els.status, "status", "change"],
    [els.turma, "turma", "change"],
    [els.categoria, "categoria", "change"],
    [els.forma, "forma", "change"],
  ];
  for (const [element, key, eventName] of bindings) {
    element.addEventListener(eventName, () => {
      state.filters[key] = element.value;
      render();
    });
  }
}

els.add.addEventListener("click", addStudent);
els.addFab.addEventListener("click", addStudent);
els.save.addEventListener("click", persistStudents);
els.toggleSearch.addEventListener("click", toggleSearchPanel);
els.exportCsv.addEventListener("click", exportCsv);
els.reset.addEventListener("click", resetData);
els.loginForm.addEventListener("submit", login);
els.logout.addEventListener("click", logout);
wireFilters();
loadSession();
render();
