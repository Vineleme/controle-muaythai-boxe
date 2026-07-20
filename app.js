const STORAGE_KEY = "controle-muaythai-alunos-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const state = {
  students: loadStudents(),
  filters: {
    search: "",
    status: "",
    turma: "",
    categoria: "",
    forma: "",
  },
};

const els = {
  rows: document.querySelector("#studentRows"),
  template: document.querySelector("#rowTemplate"),
  search: document.querySelector("#searchInput"),
  status: document.querySelector("#statusFilter"),
  turma: document.querySelector("#classFilter"),
  categoria: document.querySelector("#categoryFilter"),
  forma: document.querySelector("#paymentFilter"),
  add: document.querySelector("#addStudent"),
  addFab: document.querySelector("#addStudentFab"),
  exportCsv: document.querySelector("#exportCsv"),
  reset: document.querySelector("#resetData"),
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
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return structuredClone(window.INITIAL_STUDENTS || []);
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.students));
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
  updateClassFilter();
  const students = visibleStudents();
  els.rows.replaceChildren();

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
      input.addEventListener("input", () => updateStudent(student.id, field, input.value));
      input.addEventListener("change", () => updateStudent(student.id, field, input.value));
    }

    const pill = row.querySelector(".status-pill");
    pill.textContent = status;
    pill.className = `status-pill ${rowClass(status).replace("status-", "")}`;

    row.querySelector(".delete-row").addEventListener("click", () => {
      state.students = state.students.filter((item) => item.id !== student.id);
      saveStudents();
      render();
    });

    els.rows.append(row);
  }

  renderSummary(students);
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

function updateStudent(id, field, rawValue) {
  const student = state.students.find((item) => item.id === id);
  if (!student) return;
  student[field] = field === "valor" ? Number(String(rawValue).replace(",", ".")) || 0 : rawValue;
  if (field === "turma") {
    const [modalidade, horario] = splitClass(rawValue);
    student.modalidade = modalidade;
    student.horario = horario;
  }
  saveStudents();
  render();
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
  };
  state.students.push(newStudent);
  clearFilters();
  saveStudents();
  render();
  requestAnimationFrame(() => {
    const row = document.querySelector(`[data-id="${newStudent.id}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.querySelector('[data-field="aluno"]')?.focus();
    delete newStudent.isNew;
    saveStudents();
  });
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
  state.students = structuredClone(window.INITIAL_STUDENTS || []);
  render();
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
els.exportCsv.addEventListener("click", exportCsv);
els.reset.addEventListener("click", resetData);
wireFilters();
render();
