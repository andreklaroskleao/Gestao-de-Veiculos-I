import { listRecords, createRecord, updateRecord, deleteRecord } from './firestore.js';
import { validateExpense, showFieldErrors } from './validation.js';
import { showToast, confirmDialog, escapeHtml, formatCurrency, formatDate, todayISO } from './utils.js';

const CATEGORIES = ['Combustível', 'Manutenção', 'Pneus', 'IPVA', 'Licenciamento', 'Seguro', 'Multas', 'Pedágio', 'Estacionamento', 'Lavagem', 'Acessórios', 'Documentação', 'Alimentação', 'Outros'];

export async function loadExpenses(vehicleId) {
  return listRecords(vehicleId, 'expenses', { orderBy: 'data', orderDir: 'desc' });
}

export function renderExpensesView(state) {
  const view = document.getElementById('view-expenses');
  const canEdit = state.role === 'owner' || state.role === 'editor';
  view.innerHTML = `
    <div class="page-header">
      <h1>Despesas</h1>
      <div class="page-actions">
        ${canEdit ? '<button class="btn btn-primary" id="btn-add-expense">+ Despesa</button>' : ''}
      </div>
    </div>
    <div id="expense-summary" class="summary-bar"></div>
    <div class="table-wrap">
      <table class="data-table" id="expense-table">
        <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Cidade</th><th>Forma pgto</th><th>Valor</th>${canEdit ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  if (canEdit) document.getElementById('btn-add-expense').addEventListener('click', () => openExpenseForm(state, null));
  refreshExpenses(state);
}

export async function refreshExpenses(state) {
  const tbody = document.querySelector('#expense-table tbody');
  if (!tbody) return;
  const records = state.expenses || [];
  const total = records.reduce((a, e) => a + (Number(e.valor) || 0), 0);
  const summaryEl = document.getElementById('expense-summary');
  summaryEl.innerHTML = `<div class="summary-item"><div class="label">Total despesas</div><div class="value">${formatCurrency(total)}</div></div>
    <div class="summary-item"><div class="label">Registros</div><div class="value">${records.length}</div></div>`;
  const canEdit = state.role === 'owner' || state.role === 'editor';
  tbody.innerHTML = records.length ? records.map(e => `
    <tr>
      <td>${formatDate(e.data)}</td>
      <td>${escapeHtml(e.categoria)}</td>
      <td>${escapeHtml(e.descricao || '')}</td>
      <td>${escapeHtml(e.cidade || '')}</td>
      <td>${escapeHtml(e.formaPagamento || '')}</td>
      <td class="col-num">${formatCurrency(e.valor)}</td>
      ${canEdit ? `<td class="col-actions"><div class="row-actions">
        <button class="edit" data-id="${e.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="del" data-id="${e.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></td>` : ''}
    </tr>
  `).join('') : '<tr><td colspan="7" class="empty-state">Nenhuma despesa registrada.</td></tr>';

  if (canEdit) {
    tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => {
      const e = records.find(x => x.id === b.dataset.id);
      openExpenseForm(state, e);
    }));
    tbody.querySelectorAll('.del').forEach(b => b.addEventListener('click', async () => {
      if (!confirmDialog('Excluir esta despesa?')) return;
      await deleteRecord(state.activeVehicle.id, 'expenses', b.dataset.id);
      showToast('Despesa excluída.', 'success');
      state.reload();
    }));
  }
}

function openExpenseForm(state, exp) {
  const isEdit = !!exp;
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${isEdit ? 'Editar despesa' : 'Nova despesa'}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="expense-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Data <span class="req">*</span></label>
            <input name="data" type="date" required value="${exp?.data ? formatDate(exp.data) : todayISO()}" />
          </div>
          <div class="form-group">
            <label>Categoria <span class="req">*</span></label>
            <select name="categoria" required>
              ${CATEGORIES.map(c => `<option ${exp?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full">
            <label>Descrição</label>
            <input name="descricao" value="${escapeHtml(exp?.descricao || '')}" />
          </div>
          <div class="form-group">
            <label>Valor (R$) <span class="req">*</span></label>
            <input name="valor" type="number" step="0.01" required value="${exp?.valor ?? ''}" />
          </div>
          <div class="form-group">
            <label>Forma de pagamento</label>
            <input name="formaPagamento" value="${escapeHtml(exp?.formaPagamento || '')}" placeholder="Dinheiro, Cartão, Pix..." />
          </div>
          <div class="form-group">
            <label>Cidade</label>
            <input name="cidade" value="${escapeHtml(exp?.cidade || '')}" list="cities-list" />
          </div>
          <div class="form-group full">
            <label>Observações</label>
            <textarea name="observacoes">${escapeHtml(exp?.observacoes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Registrar'}</button>
      </div>
    </form>
  `;
  overlay.hidden = false;
  const form = document.getElementById('expense-form');
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.valor = Number(data.valor);
    const errors = validateExpense(data);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    try {
      if (isEdit) {
        await updateRecord(state.activeVehicle.id, 'expenses', exp.id, data);
        showToast('Despesa atualizada.', 'success');
      } else {
        await createRecord(state.activeVehicle.id, 'expenses', data);
        showToast('Despesa registrada.', 'success');
      }
      closeModal();
      state.reload();
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  });
}

function closeModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.getElementById('modal').innerHTML = '';
}
