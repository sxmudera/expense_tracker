/* ============================================================
   Expense Tracker — frontend logic
   Talks to the Express API at /api/expenses (same origin).
   ============================================================ */

const API_BASE = '/api/expenses';

const CATEGORIES = [
  'Makanan',
  'Transportasi',
  'Belanja',
  'Hiburan',
  'Kesehatan',
  'Pendidikan',
  'Tagihan',
  'Lainnya',
];

const PAYMENT_METHODS = ['Cash', 'Debit', 'Credit', 'E-Wallet'];

const CATEGORY_COLORS = {
  Makanan: '#c45b4d',
  Transportasi: '#3b7bb8',
  Belanja: '#b8863a',
  Hiburan: '#8a5fb8',
  Kesehatan: '#3f9e6b',
  Pendidikan: '#3f8e9e',
  Tagihan: '#9e6b3f',
  Lainnya: '#6b6b6b',
};

// ---- state ----
let editingId = null;
let pendingDeleteId = null;

// ---- DOM refs ----
const $ = (id) => document.getElementById(id);

const els = {
  statTotal: $('stat-total'),
  statCount: $('stat-count'),
  breakdown: $('category-breakdown'),
  tableBody: $('expense-table-body'),
  filterCategory: $('filter-category'),
  filterTag: $('filter-tag'),
  btnClearFilter: $('btn-clear-filter'),
  alertBox: $('alert-box'),

  formModal: $('form-modal'),
  modalTitle: $('modal-title'),
  form: $('expense-form'),
  formError: $('form-error'),
  btnOpenForm: $('btn-open-form'),
  btnCloseForm: $('btn-close-form'),
  btnCancelForm: $('btn-cancel-form'),

  fieldId: $('expense-id'),
  fieldTitle: $('field-title'),
  fieldAmount: $('field-amount'),
  fieldDate: $('field-date'),
  fieldCategory: $('field-category'),
  fieldPayment: $('field-payment'),
  fieldDescription: $('field-description'),
  fieldTags: $('field-tags'),

  confirmModal: $('confirm-modal'),
  btnCancelDelete: $('btn-cancel-delete'),
  btnConfirmDelete: $('btn-confirm-delete'),
};

// ---- helpers ----
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRupiah(value) {
  return 'Rp ' + Number(value).toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

function formatDate(isoDate) {
  if (!isoDate) return '-';
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showAlert(message) {
  els.alertBox.textContent = message;
  els.alertBox.hidden = false;
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(() => {
    els.alertBox.hidden = true;
  }, 4000);
}

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const msg = (body && body.message) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

// ---- populate static selects ----
function populateSelects() {
  for (const cat of CATEGORIES) {
    els.filterCategory.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    );
    els.fieldCategory.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    );
  }
  for (const pm of PAYMENT_METHODS) {
    els.fieldPayment.insertAdjacentHTML(
      'beforeend',
      `<option value="${escapeHtml(pm)}">${escapeHtml(pm)}</option>`
    );
  }
}

// ---- rendering ----
function renderSummary(summary) {
  els.statTotal.textContent = formatRupiah(summary.total);
  els.statCount.textContent = `${summary.count} transaksi`;

  if (!summary.byCategory.length) {
    els.breakdown.innerHTML = '<p class="empty-hint">Belum ada data</p>';
    return;
  }

  els.breakdown.innerHTML = summary.byCategory
    .map((row) => {
      const color = CATEGORY_COLORS[row.category] || '#6b6b6b';
      return `
        <div class="breakdown-row">
          <span class="dot" style="background:${color}"></span>
          <span class="name">${escapeHtml(row.category)} (${row.count})</span>
          <span class="amount">${formatRupiah(row.total)}</span>
        </div>`;
    })
    .join('');
}

function renderTable(expenses) {
  if (!expenses.length) {
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="empty-row">Belum ada pengeluaran yang cocok dengan filter ini.</td></tr>';
    return;
  }

  els.tableBody.innerHTML = expenses
    .map((e) => {
      const color = CATEGORY_COLORS[e.category] || '#6b6b6b';
      const tags = (e.tags || [])
        .map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`)
        .join('');
      return `
        <tr data-id="${e.id}">
          <td>${formatDate(e.expense_date)}</td>
          <td>
            <div>${escapeHtml(e.title)}</div>
            ${e.description ? `<div class="empty-hint">${escapeHtml(e.description)}</div>` : ''}
          </td>
          <td><span class="category-pill"><span class="dot" style="background:${color}"></span>${escapeHtml(e.category)}</span></td>
          <td>${escapeHtml(e.payment_method)}</td>
          <td class="num amount-cell">${formatRupiah(e.amount)}</td>
          <td>${tags || '<span class="empty-hint">-</span>'}</td>
          <td>
            <div class="row-actions">
              <button class="edit-btn" data-id="${e.id}" title="Edit">✎</button>
              <button class="delete-btn" data-id="${e.id}" title="Hapus">✕</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

// ---- data loading ----
async function loadAll() {
  try {
    const params = new URLSearchParams();
    if (els.filterCategory.value) params.set('category', els.filterCategory.value);
    if (els.filterTag.value.trim()) params.set('tag', els.filterTag.value.trim());
    const qs = params.toString() ? `?${params.toString()}` : '';

    const [listRes, summaryRes] = await Promise.all([
      api(qs),
      api('/summary'),
    ]);
    renderTable(listRes.data);
    renderSummary(summaryRes.data);
  } catch (err) {
    showAlert(err.message);
    els.tableBody.innerHTML =
      '<tr><td colspan="7" class="empty-row">Gagal memuat data. Pastikan server &amp; database berjalan.</td></tr>';
  }
}

// ---- form modal ----
function openCreateForm() {
  editingId = null;
  els.modalTitle.textContent = 'Tambah Pengeluaran';
  els.form.reset();
  els.fieldId.value = '';
  els.fieldDate.value = new Date().toISOString().slice(0, 10);
  els.formError.hidden = true;
  els.formModal.hidden = false;
  els.fieldTitle.focus();
}

function openEditForm(expense) {
  editingId = expense.id;
  els.modalTitle.textContent = 'Edit Pengeluaran';
  els.fieldId.value = expense.id;
  els.fieldTitle.value = expense.title;
  els.fieldAmount.value = expense.amount;
  els.fieldDate.value = expense.expense_date;
  els.fieldCategory.value = expense.category;
  els.fieldPayment.value = expense.payment_method;
  els.fieldDescription.value = expense.description || '';
  els.fieldTags.value = (expense.tags || []).join(', ');
  els.formError.hidden = true;
  els.formModal.hidden = false;
  els.fieldTitle.focus();
}

function closeForm() {
  els.formModal.hidden = true;
  editingId = null;
}

async function handleFormSubmit(e) {
  e.preventDefault();
  els.formError.hidden = true;

  const payload = {
    title: els.fieldTitle.value.trim(),
    amount: Number(els.fieldAmount.value),
    category: els.fieldCategory.value,
    payment_method: els.fieldPayment.value,
    expense_date: els.fieldDate.value,
    description: els.fieldDescription.value.trim(),
    tags: els.fieldTags.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };

  els.btnSubmit?.setAttribute('disabled', 'true');

  try {
    if (editingId) {
      await api(`/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showAlert('Pengeluaran berhasil diperbarui.');
    } else {
      await api('', { method: 'POST', body: JSON.stringify(payload) });
      showAlert('Pengeluaran berhasil ditambahkan.');
    }
    closeForm();
    await loadAll();
  } catch (err) {
    els.formError.textContent = err.message;
    els.formError.hidden = false;
  }
}

// ---- delete confirm modal ----
function openDeleteConfirm(id) {
  pendingDeleteId = id;
  els.confirmModal.hidden = false;
}

function closeDeleteConfirm() {
  pendingDeleteId = null;
  els.confirmModal.hidden = true;
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  try {
    await api(`/${pendingDeleteId}`, { method: 'DELETE' });
    showAlert('Pengeluaran berhasil dihapus.');
    closeDeleteConfirm();
    await loadAll();
  } catch (err) {
    showAlert(err.message);
    closeDeleteConfirm();
  }
}

// ---- table row action delegation ----
els.tableBody.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('.edit-btn');
  const deleteBtn = e.target.closest('.delete-btn');

  if (editBtn) {
    const id = editBtn.dataset.id;
    try {
      const res = await api(`/${id}`);
      openEditForm(res.data);
    } catch (err) {
      showAlert(err.message);
    }
  }

  if (deleteBtn) {
    openDeleteConfirm(deleteBtn.dataset.id);
  }
});

// ---- wire up events ----
els.btnOpenForm.addEventListener('click', openCreateForm);
els.btnCloseForm.addEventListener('click', closeForm);
els.btnCancelForm.addEventListener('click', closeForm);
els.form.addEventListener('submit', handleFormSubmit);

els.btnCancelDelete.addEventListener('click', closeDeleteConfirm);
els.btnConfirmDelete.addEventListener('click', confirmDelete);

els.filterCategory.addEventListener('change', loadAll);
els.filterTag.addEventListener('input', () => {
  clearTimeout(els.filterTag._t);
  els.filterTag._t = setTimeout(loadAll, 350);
});
els.btnClearFilter.addEventListener('click', () => {
  els.filterCategory.value = '';
  els.filterTag.value = '';
  loadAll();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeForm();
    closeDeleteConfirm();
  }
});

// ---- init ----
populateSelects();
loadAll();
