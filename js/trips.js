import { listRecords, createRecord, updateRecord, deleteRecord, listTripExpenses, createTripExpense, deleteTripExpense } from './firestore.js';
import { validateTrip, showFieldErrors } from './validation.js';
import { calcDistance, calcCostPerKm } from './calculations.js';
import { showToast, confirmDialog, escapeHtml, formatCurrency, formatNumber, formatDate, todayISO } from './utils.js';

export async function loadTrips(vehicleId) {
  const trips = await listRecords(vehicleId, 'trips', { orderBy: 'dataInicio', orderDir: 'desc' });
  for (const t of trips) {
    const expenses = await listTripExpenses(vehicleId, t.id);
    t._expenses = expenses;
    t._totalCost = expenses.reduce((a, e) => a + (Number(e.valor) || 0), 0);
    t._distance = calcDistance(t.kmInicial, t.kmFinal);
    t._costPerKm = t._distance ? calcCostPerKm(t._totalCost, t._distance) : null;
  }
  return trips;
}

export function renderTripsView(state) {
  const view = document.getElementById('view-trips');
  const canEdit = state.role === 'owner' || state.role === 'editor';
  view.innerHTML = `
    <div class="page-header">
      <h1>Viagens</h1>
      <div class="page-actions">
        ${canEdit ? '<button class="btn btn-primary" id="btn-add-trip">+ Viagem</button>' : ''}
      </div>
    </div>
    <div id="trips-list"></div>
  `;
  if (canEdit) document.getElementById('btn-add-trip').addEventListener('click', () => openTripForm(state, null));
  refreshTrips(state);
}

export async function refreshTrips(state) {
  const container = document.getElementById('trips-list');
  if (!container) return;
  const trips = state.trips || [];
  const canEdit = state.role === 'owner' || state.role === 'editor';
  if (!trips.length) {
    container.innerHTML = '<div class="empty-state"><h3>Sem viagens</h3><p>Registre uma viagem para acompanhar custos.</p></div>';
    return;
  }
  container.innerHTML = trips.map(t => `
    <div class="trip-card" data-trip="${t.id}">
      <div class="trip-card-header">
        <h3>${escapeHtml(t.origem)} → ${escapeHtml(t.destino)}</h3>
        ${canEdit ? `<div class="row-actions">
          <button class="btn btn-secondary btn-sm trip-edit" data-id="${t.id}">Editar</button>
          <button class="btn btn-secondary btn-sm trip-expense" data-id="${t.id}">Gastos</button>
          <button class="btn btn-danger btn-sm trip-del" data-id="${t.id}">Excluir</button>
        </div>` : ''}
      </div>
      <div class="trip-route">${formatDate(t.dataInicio)}${t.dataFim ? ' a ' + formatDate(t.dataFim) : ''} — ${escapeHtml(t.finalidade || '')}</div>
      <div class="trip-stats">
        <div class="stat">Distância: <strong>${formatNumber(t._distance || 0, 0)} km</strong></div>
        <div class="stat">Total: <strong>${formatCurrency(t._totalCost)}</strong></div>
        <div class="stat">Custo/km: <strong>${t._costPerKm ? formatCurrency(t._costPerKm) : '—'}</strong></div>
      </div>
      ${t._expenses?.length ? `<div class="table-wrap mt-2"><table class="data-table"><thead><tr><th>Gasto</th><th>Categoria</th><th>Valor</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>
        ${t._expenses.map(e => `<tr><td>${escapeHtml(e.descricao || '')}</td><td>${escapeHtml(e.categoria || '')}</td><td class="col-num">${formatCurrency(e.valor)}</td>${canEdit ? `<td class="col-actions"><button class="btn btn-danger btn-sm trip-exp-del" data-trip="${t.id}" data-id="${e.id}">×</button></td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : ''}
    </div>
  `).join('');

  if (canEdit) {
    container.querySelectorAll('.trip-edit').forEach(b => b.addEventListener('click', () => {
      const t = trips.find(x => x.id === b.dataset.id);
      openTripForm(state, t);
    }));
    container.querySelectorAll('.trip-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirmDialog('Excluir esta viagem e seus gastos?')) return;
      await deleteRecord(state.activeVehicle.id, 'trips', b.dataset.id);
      showToast('Viagem excluída.', 'success');
      state.reload();
    }));
    container.querySelectorAll('.trip-expense').forEach(b => b.addEventListener('click', () => {
      const t = trips.find(x => x.id === b.dataset.id);
      openTripExpenseForm(state, t);
    }));
    container.querySelectorAll('.trip-exp-del').forEach(b => b.addEventListener('click', async () => {
      if (!confirmDialog('Remover este gasto?')) return;
      await deleteTripExpense(state.activeVehicle.id, b.dataset.trip, b.dataset.id);
      showToast('Gasto removido.', 'success');
      state.reload();
    }));
  }
}

function openTripForm(state, trip) {
  const isEdit = !!trip;
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${isEdit ? 'Editar viagem' : 'Nova viagem'}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="trip-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Data início <span class="req">*</span></label>
            <input name="dataInicio" type="date" required value="${trip?.dataInicio ? formatDate(trip.dataInicio) : todayISO()}" />
          </div>
          <div class="form-group">
            <label>Data fim</label>
            <input name="dataFim" type="date" value="${trip?.dataFim ? formatDate(trip.dataFim) : ''}" />
          </div>
          <div class="form-group">
            <label>Origem <span class="req">*</span></label>
            <input name="origem" required value="${escapeHtml(trip?.origem || '')}" list="cities-list" />
          </div>
          <div class="form-group">
            <label>Destino <span class="req">*</span></label>
            <input name="destino" required value="${escapeHtml(trip?.destino || '')}" list="cities-list" />
          </div>
          <div class="form-group">
            <label>KM inicial <span class="req">*</span></label>
            <input name="kmInicial" type="number" required value="${trip?.kmInicial ?? ''}" />
          </div>
          <div class="form-group">
            <label>KM final <span class="req">*</span></label>
            <input name="kmFinal" type="number" required value="${trip?.kmFinal ?? ''}" />
          </div>
          <div class="form-group full">
            <label>Finalidade</label>
            <input name="finalidade" value="${escapeHtml(trip?.finalidade || '')}" />
          </div>
          <div class="form-group full">
            <label>Descrição</label>
            <textarea name="descricao">${escapeHtml(trip?.descricao || '')}</textarea>
          </div>
          <div class="form-group full">
            <label>Observações</label>
            <textarea name="observacoes">${escapeHtml(trip?.observacoes || '')}</textarea>
          </div>
        </div>
        <div class="form-computed mt-2" id="trip-dist"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Registrar'}</button>
      </div>
    </form>
  `;
  overlay.hidden = false;
  const form = document.getElementById('trip-form');
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  const updateDist = () => {
    const ki = Number(form.kmInicial.value), kf = Number(form.kmFinal.value);
    const dist = calcDistance(ki, kf);
    document.getElementById('trip-dist').innerHTML = dist !== null ? `Distância calculada: <strong>${formatNumber(dist, 0)} km</strong>` : '';
  };
  form.kmInicial.addEventListener('input', updateDist);
  form.kmFinal.addEventListener('input', updateDist);
  updateDist();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.kmInicial = Number(data.kmInicial);
    data.kmFinal = Number(data.kmFinal);
    data.distancia = calcDistance(data.kmInicial, data.kmFinal);
    const errors = validateTrip(data);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    try {
      if (isEdit) {
        await updateRecord(state.activeVehicle.id, 'trips', trip.id, data);
        showToast('Viagem atualizada.', 'success');
      } else {
        await createRecord(state.activeVehicle.id, 'trips', data);
        showToast('Viagem registrada.', 'success');
      }
      closeModal();
      state.reload();
    } catch (err) {
      showToast('Erro: ' + err.message, 'error');
    }
  });
}

function openTripExpenseForm(state, trip) {
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  const CATS = ['Combustível', 'Pedágio', 'Estacionamento', 'Alimentação', 'Hospedagem', 'Outros'];
  modal.innerHTML = `
    <div class="modal-header">
      <h2>Gasto da viagem: ${escapeHtml(trip.origem)} → ${escapeHtml(trip.destino)}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="trip-exp-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Categoria</label>
            <select name="categoria">${CATS.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="form-group">
            <label>Valor (R$) <span class="req">*</span></label>
            <input name="valor" type="number" step="0.01" required />
          </div>
          <div class="form-group full">
            <label>Descrição</label>
            <input name="descricao" />
          </div>
          <div class="form-group">
            <label>Data</label>
            <input name="data" type="date" value="${todayISO()}" />
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">Adicionar gasto</button>
      </div>
    </form>
  `;
  overlay.hidden = false;
  document.getElementById('modal-x').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('trip-exp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    data.valor = Number(data.valor);
    try {
      await createTripExpense(state.activeVehicle.id, trip.id, data);
      showToast('Gasto adicionado.', 'success');
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
