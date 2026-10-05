import { createVehicle, updateVehicle, deleteVehicle, listVehicles } from './firestore.js';
import { validateVehicle, showFieldErrors, clearFieldErrors } from './validation.js';
import { showToast, confirmDialog, escapeHtml, formatDate, formatNumber } from './utils.js';

const FUEL_TYPES = ['Gasolina comum', 'Gasolina aditivada', 'Etanol', 'Diesel', 'GNV', 'Outro'];
const VEHICLE_TYPES = ['Carro', 'Moto', 'Caminhão', 'Van', 'Ônibus', 'Outro'];

export async function loadVehiclesIntoSelector(uid, onSelect) {
  const vehicles = await listVehicles(uid);
  const sel = document.getElementById('vehicle-select');
  const current = localStorage.getItem('gv_active_vehicle');
  sel.innerHTML = '<option value="">Selecione um veículo</option>' +
    vehicles.map(v => `<option value="${v.id}">${escapeHtml(v.nome || v.modelo)} — ${v.role === 'owner' ? 'Proprietário' : v.role === 'editor' ? 'Editor' : 'Viewer'}</option>`).join('');
  if (current && vehicles.find(v => v.id === current)) {
    sel.value = current;
    onSelect(current, vehicles);
  } else if (vehicles.length === 1) {
    sel.value = vehicles[0].id;
    onSelect(vehicles[0].id, vehicles);
  }
  return vehicles;
}

export function renderVehiclesView(state) {
  const view = document.getElementById('view-vehicles');
  const canCreate = true;
  view.innerHTML = `
    <div class="page-header">
      <h1>Veículos</h1>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-new-vehicle">+ Novo veículo</button>
      </div>
    </div>
    <div id="vehicles-grid" class="grid grid-auto"></div>
  `;
  document.getElementById('btn-new-vehicle').addEventListener('click', () => openVehicleForm(state, null));
  refreshVehiclesGrid(state);
}

export async function refreshVehiclesGrid(state) {
  const grid = document.getElementById('vehicles-grid');
  if (!grid) return;
  const vehicles = state.vehicles || [];
  if (!vehicles.length) {
    grid.innerHTML = '<div class="empty-state"><h3>Nenhum veículo</h3><p>Clique em "Novo veículo" para começar.</p></div>';
    return;
  }
  const activeId = state.activeVehicle?.id;
  grid.innerHTML = vehicles.map(v => `
    <div class="vehicle-card ${v.id === activeId ? 'active' : ''}">
      <div class="vehicle-card-title">
        <h3>${escapeHtml(v.nome || v.modelo)}</h3>
        <span class="badge ${v.role === 'owner' ? 'badge-owner' : v.role === 'editor' ? 'badge-editor' : 'badge-viewer'}">${v.role === 'owner' ? 'Proprietário' : v.role === 'editor' ? 'Editor' : 'Viewer'}</span>
      </div>
      <div class="vehicle-card-info">
        <span>${escapeHtml(v.marca || '')} ${escapeHtml(v.modelo || '')} ${v.ano || ''}</span>
        <span>Combustível: ${escapeHtml(v.combustivel || '—')}</span>
        <span>KM atual: ${formatNumber(v.quilometragemAtual || 0, 0)}</span>
      </div>
      <div class="vehicle-card-actions">
        <button class="btn btn-secondary btn-sm" data-act="select" data-id="${v.id}">Selecionar</button>
        ${v.role === 'owner' ? `<button class="btn btn-secondary btn-sm" data-act="edit" data-id="${v.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-act="delete" data-id="${v.id}">Excluir</button>` : ''}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const v = vehicles.find(x => x.id === id);
      if (act === 'select') {
        document.getElementById('vehicle-select').value = id;
        document.getElementById('vehicle-select').dispatchEvent(new Event('change'));
        document.querySelector('.nav-link[data-view="dashboard"]').click();
      } else if (act === 'edit') {
        openVehicleForm(state, v);
      } else if (act === 'delete') {
        if (!confirmDialog(`Excluir "${v.nome || v.modelo}" e todos os seus registros? Esta ação não pode ser desfeita.`)) return;
        await deleteVehicle(id);
        showToast('Veículo excluído.', 'success');
        if (state.activeVehicle?.id === id) {
          localStorage.removeItem('gv_active_vehicle');
          state.activeVehicle = null;
        }
        state.reloadVehicles();
      }
    });
  });
}

function openVehicleForm(state, vehicle) {
  const isEdit = !!vehicle;
  const modal = document.getElementById('modal');
  const overlay = document.getElementById('modal-overlay');
  modal.innerHTML = `
    <div class="modal-header">
      <h2>${isEdit ? 'Editar veículo' : 'Novo veículo'}</h2>
      <button class="modal-close" id="modal-x">&times;</button>
    </div>
    <form id="vehicle-form">
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Nome/Apelido <span class="req">*</span></label>
            <input name="nome" value="${escapeHtml(vehicle?.nome || '')}" />
          </div>
          <div class="form-group">
            <label>Tipo</label>
            <select name="tipo">
              ${VEHICLE_TYPES.map(t => `<option ${vehicle?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Marca <span class="req">*</span></label>
            <input name="marca" value="${escapeHtml(vehicle?.marca || '')}" />
          </div>
          <div class="form-group">
            <label>Modelo <span class="req">*</span></label>
            <input name="modelo" value="${escapeHtml(vehicle?.modelo || '')}" />
          </div>
          <div class="form-group">
            <label>Versão</label>
            <input name="versao" value="${escapeHtml(vehicle?.versao || '')}" />
          </div>
          <div class="form-group">
            <label>Ano</label>
            <input name="ano" type="number" value="${vehicle?.ano || ''}" />
          </div>
          <div class="form-group">
            <label>Motorização</label>
            <input name="motorizacao" value="${escapeHtml(vehicle?.motorizacao || '')}" />
          </div>
          <div class="form-group">
            <label>Combustível</label>
            <select name="combustivel">
              ${FUEL_TYPES.map(f => `<option ${vehicle?.combustivel === f ? 'selected' : ''}>${f}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Capacidade do tanque (L)</label>
            <input name="capacidadeTanque" type="number" step="0.1" value="${vehicle?.capacidadeTanque || ''}" />
          </div>
          <div class="form-group">
            <label>Quilometragem atual</label>
            <input name="quilometragemAtual" type="number" value="${vehicle?.quilometragemAtual ?? ''}" />
          </div>
          <div class="form-group">
            <label>Cidade de referência</label>
            <input name="cidadeReferencia" value="${escapeHtml(vehicle?.cidadeReferencia || '')}" />
          </div>
          <div class="form-group">
            <label>Medida dos pneus</label>
            <input name="medidaPneus" value="${escapeHtml(vehicle?.medidaPneus || '')}" placeholder="ex: 195/65 R15" />
          </div>
          <div class="form-group">
            <label>Pressão recomendada (psi)</label>
            <input name="pressaoPneus" value="${escapeHtml(vehicle?.pressaoPneus || '')}" />
          </div>
          <div class="form-group full">
            <label>Observações</label>
            <textarea name="observacoes">${escapeHtml(vehicle?.observacoes || '')}</textarea>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar veículo'}</button>
      </div>
    </form>
  `;
  overlay.hidden = false;
  const form = document.getElementById('vehicle-form');
  document.getElementById('modal-x').addEventListener('click', closeVehicleModal);
  document.getElementById('modal-cancel').addEventListener('click', closeVehicleModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errors = validateVehicle(data);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;
    try {
      if (isEdit) {
        await updateVehicle(vehicle.id, data);
        showToast('Veículo atualizado.', 'success');
      } else {
        await createVehicle(data);
        showToast('Veículo criado.', 'success');
      }
      closeVehicleModal();
      state.reloadVehicles();
    } catch (err) {
      showToast('Erro ao salvar veículo: ' + err.message, 'error');
    }
  });
}

function closeVehicleModal() {
  document.getElementById('modal-overlay').hidden = true;
  document.getElementById('modal').innerHTML = '';
}
