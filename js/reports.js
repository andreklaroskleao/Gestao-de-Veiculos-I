import { generateReportPDF } from './pdf.js';
import { filterByPeriod, filterByDateRange, aggregateFinances, refuelSummary, calcRefuelSeries, consumptionByFuel, expensesByCategory } from './calculations.js';
import { formatCurrency, formatNumber, formatDate, escapeHtml, downloadFile } from './utils.js';

export function renderReportsView(state) {
  const view = document.getElementById('view-reports');
  view.innerHTML = `
    <div class="page-header"><h1>Relatórios</h1></div>
    <div class="card mb-3">
      <div class="form-grid">
        <div class="form-group">
          <label>Período</label>
          <select id="rpt-period">
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
            <option value="last_30">Últimos 30 dias</option>
            <option value="this_year">Este ano</option>
            <option value="last_year">Ano passado</option>
            <option value="all">Tudo</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>
        <div class="form-group" id="rpt-custom" hidden>
          <label>Data inicial</label>
          <input type="date" id="rpt-start" />
        </div>
        <div class="form-group" id="rpt-custom2" hidden>
          <label>Data final</label>
          <input type="date" id="rpt-end" />
        </div>
      </div>
      <h3 class="mt-3 mb-1">Seções</h3>
      <div class="radio-grid" id="rpt-sections">
        <label class="radio-pill"><input type="checkbox" value="resumo" checked /> Resumo</label>
        <label class="radio-pill"><input type="checkbox" value="abastecimentos" checked /> Abastecimentos</label>
        <label class="radio-pill"><input type="checkbox" value="consumo" checked /> Consumo</label>
        <label class="radio-pill"><input type="checkbox" value="manutencao" checked /> Manutenção</label>
        <label class="radio-pill"><input type="checkbox" value="despesas" checked /> Despesas</label>
        <label class="radio-pill"><input type="checkbox" value="viagens" checked /> Viagens</label>
      </div>
      <div class="page-actions mt-3">
        <button class="btn btn-primary" id="rpt-pdf">Gerar PDF</button>
        <button class="btn btn-secondary" id="rpt-print">Imprimir</button>
        <button class="btn btn-secondary" id="rpt-json">Exportar JSON</button>
        <button class="btn btn-secondary" id="rpt-csv">Exportar CSV</button>
      </div>
    </div>
    <div id="rpt-preview"></div>
  `;

  const periodSel = document.getElementById('rpt-period');
  periodSel.addEventListener('change', () => {
    const isCustom = periodSel.value === 'custom';
    document.getElementById('rpt-custom').hidden = !isCustom;
    document.getElementById('rpt-custom2').hidden = !isCustom;
    updatePreview(state);
  });
  ['rpt-start', 'rpt-end'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => updatePreview(state));
  });
  document.querySelectorAll('#rpt-sections input').forEach(cb => cb.addEventListener('change', () => updatePreview(state)));

  document.getElementById('rpt-pdf').addEventListener('click', () => exportPDF(state));
  document.getElementById('rpt-print').addEventListener('click', () => window.print());
  document.getElementById('rpt-json').addEventListener('click', () => exportJSON(state));
  document.getElementById('rpt-csv').addEventListener('click', () => exportCSV(state));
  updatePreview(state);
}

function getFiltered(state) {
  const period = document.getElementById('rpt-period').value;
  let refuels = state.refuels || [];
  let maintenances = state.maintenances || [];
  let expenses = state.expenses || [];
  let trips = state.trips || [];
  if (period === 'custom') {
    const s = document.getElementById('rpt-start').value;
    const e = document.getElementById('rpt-end').value;
    refuels = filterByDateRange(refuels, s, e);
    maintenances = filterByDateRange(maintenances, s, e);
    expenses = filterByDateRange(expenses, s, e);
    trips = filterByDateRange(trips, s, e, 'dataInicio');
  } else {
    refuels = filterByPeriod(refuels, period);
    maintenances = filterByPeriod(maintenances, period);
    expenses = filterByPeriod(expenses, period);
    trips = filterByPeriod(trips, period, 'dataInicio');
  }
  return { refuels, maintenances, expenses, trips };
}

function getSections() {
  return Array.from(document.querySelectorAll('#rpt-sections input:checked')).map(cb => cb.value);
}

function periodLabel() {
  const period = document.getElementById('rpt-period').value;
  const labels = {
    this_month: 'Este mês', last_month: 'Mês passado', last_30: 'Últimos 30 dias',
    this_year: 'Este ano', last_year: 'Ano passado', all: 'Todos os registros', custom: 'Personalizado',
  };
  if (period === 'custom') {
    const s = document.getElementById('rpt-start').value;
    const e = document.getElementById('rpt-end').value;
    return `${s || '...'} a ${e || '...'}`;
  }
  return labels[period] || period;
}

function updatePreview(state) {
  const { refuels, maintenances, expenses, trips } = getFiltered(state);
  const sections = getSections();
  const finances = aggregateFinances({
    refuels, maintenances, expenses, trips,
    odometerKm: state.activeVehicle?.quilometragemAtual ? Number(state.activeVehicle.quilometragemAtual) : null,
  });
  const preview = document.getElementById('rpt-preview');
  let html = '';
  if (sections.includes('resumo')) {
    html += `<div class="card mb-2"><h2>Resumo Financeiro</h2>
      <div class="summary-bar">
        <div class="summary-item"><div class="label">Total</div><div class="value">${formatCurrency(finances.grandTotal)}</div></div>
        <div class="summary-item"><div class="label">Combustível</div><div class="value">${formatCurrency(finances.refuelTotal)}</div></div>
        <div class="summary-item"><div class="label">Manutenção</div><div class="value">${formatCurrency(finances.maintenanceTotal)}</div></div>
        <div class="summary-item"><div class="label">Despesas</div><div class="value">${formatCurrency(finances.expenseTotal)}</div></div>
        <div class="summary-item"><div class="label">Custo/km</div><div class="value">${finances.costPerKm ? formatCurrency(finances.costPerKm) : '—'}</div></div>
      </div></div>`;
  }
  if (sections.includes('abastecimentos') && refuels.length) {
    const series = calcRefuelSeries(refuels);
    html += `<div class="card mb-2"><h2>Abastecimentos</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>KM</th><th>Comb.</th><th>Litros</th><th>R$/L</th><th>Total</th><th>km/L</th></tr></thead><tbody>
      ${series.map(r => `<tr><td>${formatDate(r.data)}</td><td class="col-num">${formatNumber(r.quilometragem, 0)}</td><td>${escapeHtml(r.combustivel)}</td><td class="col-num">${formatNumber(r.litros)}</td><td class="col-num">${formatCurrency(r.precoPorLitro)}</td><td class="col-num">${formatCurrency(r._valorTotal)}</td><td class="col-num">${r._consumption ? formatNumber(r._consumption, 1) : '—'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  if (sections.includes('manutencao') && maintenances.length) {
    html += `<div class="card mb-2"><h2>Manutenções</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Categoria</th><th>Serviço</th><th>Valor</th></tr></thead><tbody>
      ${maintenances.map(m => `<tr><td>${formatDate(m.data)}</td><td>${escapeHtml(m.categoria)}</td><td>${escapeHtml(m.servico)}</td><td class="col-num">${formatCurrency(m.valor)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  if (sections.includes('despesas') && expenses.length) {
    html += `<div class="card mb-2"><h2>Despesas</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>
      ${expenses.map(e => `<tr><td>${formatDate(e.data)}</td><td>${escapeHtml(e.categoria)}</td><td>${escapeHtml(e.descricao || '')}</td><td class="col-num">${formatCurrency(e.valor)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  if (sections.includes('viagens') && trips.length) {
    html += `<div class="card mb-2"><h2>Viagens</h2><div class="table-wrap"><table class="data-table"><thead><tr><th>Início</th><th>Origem</th><th>Destino</th><th>Distância</th><th>Custo</th></tr></thead><tbody>
      ${trips.map(t => `<tr><td>${formatDate(t.dataInicio)}</td><td>${escapeHtml(t.origem)}</td><td>${escapeHtml(t.destino)}</td><td class="col-num">${formatNumber(t._distance || (t.kmFinal - t.kmInicial), 0)} km</td><td class="col-num">${formatCurrency(t._totalCost || 0)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  preview.innerHTML = html || '<div class="empty-state"><p>Sem dados para os filtros selecionados.</p></div>';
}

function exportPDF(state) {
  const { refuels, maintenances, expenses, trips } = getFiltered(state);
  const finances = aggregateFinances({
    refuels, maintenances, expenses, trips,
    odometerKm: state.activeVehicle?.quilometragemAtual ? Number(state.activeVehicle.quilometragemAtual) : null,
  });
  generateReportPDF({
    vehicle: state.activeVehicle,
    periodLabel: periodLabel(),
    finances,
    refuels: calcRefuelSeries(refuels),
    maintenances, expenses, trips,
    sections: getSections(),
  });
}

function exportJSON(state) {
  const { refuels, maintenances, expenses, trips } = getFiltered(state);
  const data = {
    vehicle: state.activeVehicle,
    period: periodLabel(),
    generatedAt: new Date().toISOString(),
    refuels, maintenances, expenses, trips,
  };
  downloadFile(`gestao_${state.activeVehicle?.nome || 'veiculo'}.json`, JSON.stringify(data, null, 2), 'application/json');
}

function exportCSV(state) {
  const { refuels, maintenances, expenses, trips } = getFiltered(state);
  const lines = [['tipo', 'data', 'descricao', 'categoria', 'valor', 'quilometragem']];
  refuels.forEach(r => lines.push(['abastecimento', formatDate(r.data), r.combustivel, 'combustivel', (r.valorTotal || r.litros * r.precoPorLitro).toFixed(2), r.quilometragem]));
  maintenances.forEach(m => lines.push(['manutencao', formatDate(m.data), m.servico, m.categoria, (m.valor || 0).toFixed(2), m.quilometragem]));
  expenses.forEach(e => lines.push(['despesa', formatDate(e.data), e.descricao || '', e.categoria, (e.valor || 0).toFixed(2), '']));
  trips.forEach(t => lines.push(['viagem', formatDate(t.dataInicio), `${t.origem} -> ${t.destino}`, 'viagem', (t._totalCost || 0).toFixed(2), t._distance || '']));
  const csv = lines.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(`gestao_${state.activeVehicle?.nome || 'veiculo'}.csv`, csv, 'text/csv');
}
