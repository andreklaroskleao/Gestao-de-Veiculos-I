import { listRecords, createRecord, updateRecord, deleteRecord } from './firestore.js';
import { validateRefuel, showFieldErrors } from './validation.js';
import { calcRefuelSeries, refuelSummary, formatConsumption } from './calculations.js';
import { showToast, confirmDialog, escapeHtml, formatCurrency, formatNumber, formatDate, todayISO } from './utils.js';

const FUELS = ['Gasolina comum', 'Gasolina aditivada', 'Etanol', 'Diesel', 'GNV', 'Outro'];

export async function loadRefuels(vehicleId) {
  return listRecords(vehicleId, 'refuels', { orderBy: 'data', orderDir: 'desc' });
}

export function renderRefuelsView(state) {
  const view = document.getElementById('view-refuels');
  const role = state.role;
  const canEdit = role === 'owner' || role === 'editor';
  view.innerHTML = `
    <div class="page-header">
      <h1>Abastecimentos</h1>
      <div class="page-actions">
        ${canEdit ? '<button class="btn btn-primary" id="btn-add-refuel">+ Abastecimento</button>' : ''}
      </div>
    </div>
    <div id="refuel-summary" class="summary-bar"></div>
    <div class="table-wrap">
      <table class="data-table" id="refuel-table">
        <thead><tr><th>Data</th><th>KM</th><th>Cidade</th><th>Combustível</th><th>Litros</th><th>R$/L</th><th>Total</th><th>Tanque</th><th>km/L</th>${canEdit ? '<th class="col-actions">Ações</th>' : ''}</tr></thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  if (canEdit) document.getElementById('btn-add-refuel').addEventListener('click', () => openRefuelForm(state, null));
  refreshRefuels(state);
}

export async function refreshRefuels(state) {
  const tbody = document.querySelector('#refuel-table tbody');
  const summaryEl = document.getElementById('refuel-summary');
  if (!tbody) return;
  const refuels = state.refuels || [];
  const series = calcRefuelSeries(refuels);
  const summary = refuelSummary(refuels);
  summaryEl.innerHTML = `
    <div class="summary-item"><div class="label">Total gasto</div><div class="value">${formatCurrency(summary.totalSpent)}</div></div>
    <div class="summary-item"><div class="label">Litros</div><div class="value">${formatNumber(summary.totalLiters, 1)}</div></div>
    <div class="summary-item"><div class="label">Consumo médio</div><div class="value">${summary.avgConsumption ? formatNumber(summary.avgConsumption, 1) + ' km/L' : '—'}</div></div>
    <div class="summary-item"><div class="label">Custo/km</div><div class="value">${summary.overallCostPerKm ? formatCurrency(summary.overallCostPerKm) : '—'}</div></div>
  `;
  const canEdit = state.role === 'owner' || state.role === 'editor';
  tbody.innerHTML = series.length ? series.map(r => `
    <tr>
      <td>${formatDate(r.data)}</td>
      <td class="col-num">${formatNumber(r.quilometragem, 0)}</td>
      <td>${escapeHtml(r.cidade || '')}</td>
      <td>${escapeHtml(r.combustivel)}</td>
      <td class="col-num">${formatNumber(r.litros)}</td>
      <td class="col-num">${formatCurrency(r.precoPorLitro)}</td>
      <td class="col-num">${formatCurrency(r._valorTotal)}</td>
      <td>${r.tanqueCheio ? 'Cheio' : 'Parcial'}</td>
      <td class="col-num">${r._consumption ? formatNumber(r._consumption, 1) : '—'}</td>
      ${canEdit ? `<td class="col-actions"><div class="row-actions">
        <button class="edit" data-id="${r.id}" title="Editar"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
        <button class="del" data-id="${r.id}" title="Excluir"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
      </div></td>` : ''}
    </tr>
  `).join('') : '<tr><td colspan="10" class="empty-state">Nenhum abastecimento registrado.</td></tr>';

  if (canEdit) {
    tbody.querySelectorAll('.edit').forEach(b => b.addEventListener('click', () => {
      const r = refuels.find(x => x.id === b.dataset.id);
      openRefuelForm(state, r);
    }));
    tbody.querySelectorAll('.del').forEach(b => b.addEventListener('click', async () => {
      if (!confirmDialog('Excluir este abastecimento?')) return;
      await deleteRecord(state.activeVehicle.id, 'refuels', b.dataset.id);
      showToast('Abastecimento excluído.', 'success');
      state.reload();
    }));
  }
}

function openRefuelForm(state, refuel) {
  const isEdit = !!refuel;
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  const lastKm = state.activeVehicle?.quilometragemAtual || 0;
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${isEdit ? 'Editar abastecimento' : 'Novo abastecimento'}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="refuel-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Data <span class="req">*</span></label>
            <input name="data" type="date" required value="${refuel?.data ? formatDate(refuel.data) : todayISO()}" />
          </div>
          <div class="form-group">
            <label>Quilometragem <span class="req">*</span></label>
            <input name="quilometragem" type="number" required value="${refuel?.quilometragem ?? ''}" placeholder="atual: ${lastKm} km" />
          </div>
          <div class="form-group">
            <label>Cidade</label>
            <input name="cidade" value="${escapeHtml(refuel?.cidade || '')}" list="cities-list" />
          </div>
          <div class="form-group">
            <label>Combustível <span class="req">*</span></label>
            <select name="combustivel" required>
              ${FUELS.map(f => `<option ${refuel?.combustivel === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Litros <span class="req">*</span></label>
            <input name="litros" type="number" step="0.001" required value="${refuel?.litros ?? ''}" />
          </div>
          <div class="form-group">
            <label>Preço por litro (R$) <span class="req">*</span></label>
            <input name="precoPorLitro" type="number" step="0.001" required value="${refuel?.precoPorLitro ?? ''}" />
          </div>
          <div class="form-group">
            <label>Valor total (R$)</label>
            <input name="valorTotal" type="number" step="0.01" value="${refuel?.valorTotal ?? ''}" />
          </div>
          <div class="form-group">
            <label>Posto</label>
            <input name="posto" value="${escapeHtml(refuel?.posto || '')}" />
          </div>
          <div class="form-group full">
            <div class="checkbox-group">
              <input type="checkbox" name="tanqueCheio" id="tanque-cheio" ${refuel?.tanqueCheio ? 'checked' : ''} />
              <label for="tanque-cheio" style="margin:0">Tanque cheio</label>
            </div>
            <span class="hint">Necessário para cálculo correto do consumo.</span>
          </div>
          <div class="form-group full">
            <label>Observações</label>
            <textarea name="observacoes">${escapeHtml(refuel?.observacoes || '')}</textarea>
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
  const form = document.getElementById('refuel-form');
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.quilometragem = Number(data.quilometragem);
    data.litros = Number(data.litros);
    data.precoPorLitro = Number(data.precoPorLitro);
    data.tanqueCheio = !!data.tanqueCheio;
    if (data.valorTotal) data.valorTotal = Number(data.valorTotal);
    else data.valorTotal = data.litros * data.precoPorLitro;
    const errors = validateRefuel(data, lastKm);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    try {
      if (isEdit) {
        await updateRecord(state.activeVehicle.id, 'refuels', refuel.id, data);
        showToast('Abastecimento atualizado.', 'success');
      } else {
        await createRecord(state.activeVehicle.id, 'refuels', data);
        const summary = refuelSummary([...(state.refuels || []), data]);
        let msg = 'Abastecimento registrado com sucesso.';
        if (summary.avgConsumption) msg += `\nConsumo médio: ${formatConsumption(summary.avgConsumption)}`;
        if (summary.overallCostPerKm) msg += `\nCusto: R$ ${summary.overallCostPerKm.toFixed(2)}/km`;
        showToast(msg, 'success', 6000);
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
