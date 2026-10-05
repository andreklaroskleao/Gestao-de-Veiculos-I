import { listRecords, createRecord, updateRecord, deleteRecord } from './firestore.js';
import { validateMaintenance, showFieldErrors } from './validation.js';
import { showToast, confirmDialog, escapeHtml, formatCurrency, formatNumber, formatDate, todayISO } from './utils.js';

const CATEGORIES = ['Motor', 'Lubrificação', 'Freios', 'Suspensão', 'Pneus', 'Elétrica', 'Ar-condicionado', 'Transmissão', 'Direção', 'Arrefecimento', 'Funilaria', 'Estética', 'Documentação', 'Outros'];

const TIRE_SERVICES = ['Compra', 'Troca', 'Conserto', 'Furo', 'Alinhamento', 'Balanceamento', 'Rodízio', 'Outros'];
const QUICK_SERVICES = [
  { label: 'Troca de óleo', cat: 'Lubrificação', serv: 'Troca de óleo' },
  { label: 'Correia dentada', cat: 'Motor', serv: 'Correia dentada' },
  { label: 'Pneus', cat: 'Pneus', serv: 'Troca de pneus' },
  { label: 'Freios', cat: 'Freios', serv: 'Revisão de freios' },
];

export async function loadMaintenances(vehicleId) {
  return listRecords(vehicleId, 'maintenances', { orderBy: 'data', orderDir: 'desc' });
}

export function renderMaintenancesView(state) {
  const view = document.getElementById('view-maintenances');
  const canEdit = state.role === 'owner' || state.role === 'editor';
  view.innerHTML = `
    <div class="page-header">
      <h1>Manutenções</h1>
      <div class="page-actions">
        ${canEdit ? '<button class="btn btn-primary" id="btn-add-maint">+ Manutenção</button>' : ''}
      </div>
    </div>
    <div class="filter-bar">
      <label>Categoria:</label>
      <select id="maint-filter">
        <option value="">Todas</option>
        ${CATEGORIES.map(c => `<option>${c}</option>`).join('')}
        <option>Pneus</option>
      </select>
    </div>
    <div id="maint-alerts" class="mb-2"></div>
    <div class="table-wrap">
      <table class="data-table" id="maint-table">
        <thead><tr><th>Data</th><th>KM</th><th>Categoria</th><th>Serviço</th><th>Valor</th><th>Próxima</th>${canEdit ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  if (canEdit) document.getElementById('btn-add-maint').addEventListener('click', () => openMaintForm(state, null));
  document.getElementById('maint-filter').addEventListener('change', () => refreshMaintenances(state));
  refreshMaintenances(state);
}

export async function refreshMaintenances(state) {
  const tbody = document.querySelector('#maint-table tbody');
  if (!tbody) return;
  const filter = document.getElementById('maint-filter')?.value || '';
  let records = state.maintenances || [];
  if (filter) records = records.filter(m => (m.categoria || '').toLowerCase() === filter.toLowerCase() || (m.servico || '').toLowerCase().includes(filter.toLowerCase()));
  const canEdit = state.role === 'owner' || state.role === 'editor';
  tbody.innerHTML = records.length ? records.map(m => `
    <tr>
      <td>${formatDate(m.data)}</td>
      <td class="col-num">${formatNumber(m.quilometragem, 0)}</td>
      <td>${escapeHtml(m.categoria)}</td>
      <td>${escapeHtml(m.servico)}${m.detalhes ? `<br><span class="muted">${escapeHtml(m.detalhes)}</span>` : ''}</td>
      <td class="col-num">${formatCurrency(m.valor)}</td>
      <td>${m.proximaQuilometragem ? formatNumber(m.proximaQuilometragem, 0) + ' km' : ''}${m.proximaData ? `<br>${formatDate(m.proximaData)}` : '—'}</td>
      ${canEdit ? `<td class="col-actions"><div class="row-actions">
        <button class="edit" data-id="${m.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="del" data-id="${m.id}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></td>` : ''}
    </tr>
  `).join('') : '<tr><td colspan="7" class="empty-state">Nenhuma manutenção registrada.</td></tr>';

  if (canEdit) {
    tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => {
      const m = records.find(x => x.id === b.dataset.id);
      openMaintForm(state, m);
    }));
    tbody.querySelectorAll('.del').forEach(b => b.addEventListener('click', async () => {
      if (!confirmDialog('Excluir esta manutenção?')) return;
      await deleteRecord(state.activeVehicle.id, 'maintenances', b.dataset.id);
      showToast('Manutenção excluída.', 'success');
      state.reload();
    }));
  }
  renderMaintenanceAlerts(state);
}

function renderMaintenanceAlerts(state) {
  const el = document.getElementById('maint-alerts');
  if (!el) return;
  const currentKm = Number(state.activeVehicle?.quilometragemAtual) || 0;
  const now = new Date();
  const alerts = [];
  for (const m of (state.maintenances || [])) {
    if (m.proximaQuilometragem) {
      const remaining = Number(m.proximaQuilometragem) - currentKm;
      if (remaining <= 1000 && remaining > -500) {
        alerts.push({ tipo: 'km', label: `${m.servico}`, detail: remaining >= 0 ? `Faltam ${formatNumber(remaining, 0)} km` : `Vencida há ${formatNumber(-remaining, 0)} km`, severity: remaining < 0 ? 'danger' : 'warning' });
      }
    }
    if (m.proximaData) {
      const d = new Date(m.proximaData);
      const days = Math.ceil((d - now) / 86400000);
      if (days <= 30) {
        alerts.push({ tipo: 'data', label: m.servico, detail: days >= 0 ? `Vence em ${days} dias (${formatDate(m.proximaData)})` : `Vencida há ${-days} dias`, severity: days < 0 ? 'danger' : 'warning' });
      }
    }
  }
  if (!alerts.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="alert ${alerts.some(a => a.severity === 'danger') ? 'alert-error' : 'alert-warning'}">
    <strong>Alertas de manutenção</strong>
    <div class="alert-list mt-1">
      ${alerts.map(a => `<div class="alert-item"><span class="badge ${a.severity === 'danger' ? 'badge-danger' : 'badge-warning'}">${a.tipo === 'km' ? 'KM' : 'Data'}</span> <strong>${escapeHtml(a.label)}</strong> — ${a.detail}</div>`).join('')}
    </div>
  </div>`;
}

function openMaintForm(state, m) {
  const isEdit = !!m;
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  const lastKm = state.activeVehicle?.quilometragemAtual || 0;
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${isEdit ? 'Editar manutenção' : 'Nova manutenção'}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="maint-form">
      <div class="modal-body">
        ${!isEdit ? `<div class="form-computed mb-2"><strong>Atalhos:</strong> ${QUICK_SERVICES.map((q, i) => `<button type="button" class="btn btn-secondary btn-sm" data-quick="${i}">${q.label}</button>`).join(' ')}</div>` : ''}
        <div class="form-grid">
          <div class="form-group">
            <label>Data <span class="req">*</span></label>
            <input name="data" type="date" required value="${m?.data ? formatDate(m.data) : todayISO()}" />
          </div>
          <div class="form-group">
            <label>Quilometragem</label>
            <input name="quilometragem" type="number" value="${m?.quilometragem ?? ''}" placeholder="atual: ${lastKm} km" />
          </div>
          <div class="form-group">
            <label>Cidade</label>
            <input name="cidade" value="${escapeHtml(m?.cidade || '')}" list="cities-list" />
          </div>
          <div class="form-group">
            <label>Categoria <span class="req">*</span></label>
            <select name="categoria" required>
              ${CATEGORIES.map(c => `<option ${m?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group full">
            <label>Serviço <span class="req">*</span></label>
            <input name="servico" required value="${escapeHtml(m?.servico || '')}" placeholder="ex: Troca de óleo, Correia dentada" />
          </div>
          <div class="form-group">
            <label>Valor (R$)</label>
            <input name="valor" type="number" step="0.01" value="${m?.valor ?? ''}" />
          </div>
          <div class="form-group">
            <label>Oficina</label>
            <input name="oficina" value="${escapeHtml(m?.oficina || '')}" />
          </div>
          <div class="form-group">
            <label>Forma de pagamento</label>
            <input name="formaPagamento" value="${escapeHtml(m?.formaPagamento || '')}" />
          </div>
          <div class="form-group">
            <label>Próxima quilometragem</label>
            <input name="proximaQuilometragem" type="number" value="${m?.proximaQuilometragem ?? ''}" />
          </div>
          <div class="form-group">
            <label>Próxima data</label>
            <input name="proximaData" type="date" value="${m?.proximaData ? formatDate(m.proximaData) : ''}" />
          </div>
          <div class="form-group full">
            <label>Detalhes</label>
            <textarea name="detalhes">${escapeHtml(m?.detalhes || '')}</textarea>
          </div>
          <div class="form-group full">
            <label>Observações</label>
            <textarea name="observacoes">${escapeHtml(m?.observacoes || '')}</textarea>
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
  const form = document.getElementById('maint-form');
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  form.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => {
    const q = QUICK_SERVICES[Number(b.dataset.quick)];
    form.categoria.value = q.cat;
    form.servico.value = q.serv;
  }));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (data.quilometragem) data.quilometragem = Number(data.quilometragem);
    if (data.valor) data.valor = Number(data.valor);
    if (data.proximaQuilometragem) data.proximaQuilometragem = Number(data.proximaQuilometragem);
    const errors = validateMaintenance(data);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    try {
      if (isEdit) {
        await updateRecord(state.activeVehicle.id, 'maintenances', m.id, data);
        showToast('Manutenção atualizada.', 'success');
      } else {
        await createRecord(state.activeVehicle.id, 'maintenances', data);
        showToast('Manutenção registrada.', 'success');
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
