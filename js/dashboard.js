import { filterByPeriod, filterByDateRange, aggregateFinances, refuelSummary, consumptionByFuel, compareFuels, expensesByCategory, monthlyBreakdown, calcRefuelSeries } from './calculations.js';
import { formatCurrency, formatNumber, formatDate, escapeHtml } from './utils.js';

let chartInstances = {};
function destroyCharts() {
  Object.values(chartInstances).forEach(c => { try { c.destroy(); } catch {} });
  chartInstances = {};
}

export function renderDashboard(state) {
  const view = document.getElementById('view-dashboard');
  const v = state.activeVehicle;
  if (!v) {
    view.innerHTML = '<div class="empty-state"><h3>Nenhum veículo selecionado</h3><p>Selecione ou crie um veículo para começar.</p></div>';
    return;
  }
  const period = state.dashboardPeriod || 'this_month';
  const refuels = filterByPeriod(state.refuels || [], period);
  const maintenances = filterByPeriod(state.maintenances || [], period);
  const expenses = filterByPeriod(state.expenses || [], period);
  const trips = filterByPeriod(state.trips || [], period, 'dataInicio');
  const finances = aggregateFinances({
    refuels, maintenances, expenses, trips,
    odometerKm: Number(v.quilometragemAtual) || 0,
  });
  const summary = refuelSummary(state.refuels || []);

  view.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
      <div class="page-actions">
        <select id="dash-period">
          <option value="this_week">Esta semana</option>
          <option value="this_month" ${period === 'this_month' ? 'selected' : ''}>Este mês</option>
          <option value="last_30">Últimos 30 dias</option>
          <option value="this_year">Este ano</option>
          <option value="all">Tudo</option>
        </select>
      </div>
    </div>
    <div class="muted mb-2"><strong>${escapeHtml(v.nome || v.modelo)}</strong> — ${escapeHtml(v.marca || '')} ${escapeHtml(v.modelo || '')} ${v.ano || ''}</div>
    <div class="stat-grid">
      <div class="stat-card"><div class="icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg></div><div class="card-title">KM atual</div><div class="card-value">${formatNumber(v.quilometragemAtual || 0, 0)}</div></div>
      <div class="stat-card"><div class="icon green"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><div class="card-title">Gasto do período</div><div class="card-value">${formatCurrency(finances.grandTotal)}</div></div>
      <div class="stat-card"><div class="icon amber"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg></div><div class="card-title">Combustível</div><div class="card-value">${formatCurrency(finances.refuelTotal)}</div></div>
      <div class="stat-card"><div class="icon red"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></div><div class="card-title">Manutenção</div><div class="card-value">${formatCurrency(finances.maintenanceTotal)}</div></div>
      <div class="stat-card"><div class="icon gray"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="card-title">Custo/km</div><div class="card-value">${finances.costPerKm ? formatCurrency(finances.costPerKm) : '—'}</div></div>
      <div class="stat-card"><div class="icon blue"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg></div><div class="card-title">Consumo médio</div><div class="card-value">${summary.avgConsumption ? formatNumber(summary.avgConsumption, 1) + ' km/L' : '—'}</div></div>
    </div>

    <div class="dashboard-section">
      <h2>Atalhos</h2>
      <div class="shortcut-grid">
        <button class="shortcut-btn" data-add="refuel"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/></svg>+ Abastecimento</button>
        <button class="shortcut-btn" data-add="maintenance"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>+ Manutenção</button>
        <button class="shortcut-btn" data-add="expense"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>+ Despesa</button>
        <button class="shortcut-btn" data-add="trip"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>+ Viagem</button>
      </div>
    </div>

    <div id="dash-alerts" class="dashboard-section"></div>

    <div class="dashboard-section">
      <h2>Gastos mensais</h2>
      <div class="chart-container"><div class="chart-wrapper"><canvas id="chart-monthly"></canvas></div></div>
    </div>

    <div class="dashboard-section">
      <h2>Gastos por categoria</h2>
      <div class="chart-container"><div class="chart-wrapper"><canvas id="chart-category"></canvas></div></div>
    </div>

    <div class="dashboard-section">
      <h2>Comparação de combustíveis</h2>
      <div class="compare-grid" id="compare-grid"></div>
    </div>
  `;

  document.getElementById('dash-period').addEventListener('change', (e) => {
    state.dashboardPeriod = e.target.value;
    renderDashboard(state);
  });
  view.querySelectorAll('.shortcut-btn').forEach(b => b.addEventListener('click', () => {
    state.openAdd(b.dataset.add);
  }));
  renderDashboardAlerts(state);
  renderDashboardCharts(state);
}

function renderDashboardAlerts(state) {
  const el = document.getElementById('dash-alerts');
  if (!el) return;
  const currentKm = Number(state.activeVehicle?.quilometragemAtual) || 0;
  const now = new Date();
  const alerts = [];
  for (const m of (state.maintenances || [])) {
    if (m.proximaQuilometragem) {
      const remaining = Number(m.proximaQuilometragem) - currentKm;
      if (remaining <= 1000) alerts.push({ label: m.servico, detail: remaining >= 0 ? `Faltam ${formatNumber(remaining, 0)} km` : `Vencida`, sev: remaining < 0 ? 'danger' : 'warning' });
    }
    if (m.proximaData) {
      const d = new Date(m.proximaData);
      const days = Math.ceil((d - now) / 86400000);
      if (days <= 30) alerts.push({ label: m.servico, detail: days >= 0 ? `Vence em ${days} dias` : `Vencida`, sev: days < 0 ? 'danger' : 'warning' });
    }
  }
  if (!alerts.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<h2>Alertas</h2><div class="alert ${alerts.some(a => a.sev === 'danger') ? 'alert-error' : 'alert-warning'}"><div class="alert-list">${alerts.map(a => `<div class="alert-item"><span class="badge ${a.sev === 'danger' ? 'badge-danger' : 'badge-warning'}">!</span> <strong>${escapeHtml(a.label)}</strong> — ${a.detail}</div>`).join('')}</div></div>`;
}

function renderDashboardCharts(state) {
  destroyCharts();
  const { Chart } = state.charts;
  if (!Chart) return;
  const allRecords = [
    ...(state.refuels || []).map(r => ({ data: r.data, valor: Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro), cat: 'Combustível' })),
    ...(state.maintenances || []).map(m => ({ data: m.data, valor: Number(m.valor) || 0, cat: 'Manutenção' })),
    ...(state.expenses || []).map(e => ({ data: e.data, valor: Number(e.valor) || 0, cat: e.categoria })),
  ];
  const monthly = monthlyBreakdown(allRecords).slice(-12);
  const ctxM = document.getElementById('chart-monthly');
  if (ctxM) {
    chartInstances.monthly = new Chart(ctxM, {
      type: 'bar',
      data: {
        labels: monthly.map(m => { const [y, mo] = m.key.split('-'); return `${mo}/${y.slice(2)}`; }),
        datasets: [{ label: 'Gastos', data: monthly.map(m => m.value), backgroundColor: 'rgba(47,110,240,0.7)' }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: v => 'R$ ' + v } } } },
    });
  }
  const byCat = expensesByCategory([
    ...(state.refuels || []).map(r => ({ categoria: 'Combustível', valor: Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro) })),
    ...(state.maintenances || []).map(m => ({ categoria: 'Manutenção', valor: Number(m.valor) || 0 })),
    ...(state.expenses || []).map(e => ({ categoria: e.categoria, valor: Number(e.valor) || 0 })),
  ]);
  const ctxC = document.getElementById('chart-category');
  if (ctxC) {
    chartInstances.category = new Chart(ctxC, {
      type: 'doughnut',
      data: {
        labels: Object.keys(byCat),
        datasets: [{ data: Object.values(byCat), backgroundColor: ['#2f6ef0', '#10b95f', '#f5b400', '#ef4444', '#8ab8ff', '#34d27b', '#cbd5e1', '#ffcf5c'] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } },
    });
  }
  const compareData = consumptionByFuel(state.refuels || []);
  const ranked = compareFuels(compareData).ranked;
  const compareEl = document.getElementById('compare-grid');
  if (compareEl) {
    compareEl.innerHTML = ranked.length ? ranked.map((f, i) => `
      <div class="compare-card ${i === 0 ? 'best' : ''}">
        <div class="fuel-name">${escapeHtml(f.fuel)}</div>
        <div class="fuel-cost">${f.costPerKm ? formatCurrency(f.costPerKm) + '/km' : '—'}</div>
        <div class="fuel-detail">${f.avgConsumption ? formatNumber(f.avgConsumption, 1) + ' km/L' : '—'} • ${f.avgPrice ? formatCurrency(f.avgPrice) + '/L' : '—'}</div>
        ${i === 0 ? '<div class="fuel-detail" style="color:var(--secondary-700);font-weight:600">Melhor custo</div>' : ''}
      </div>
    `).join('') : '<p class="muted">Registre abastecimentos com tanque cheio para comparar.</p>';
  }
}

export function renderFinanceView(state) {
  const view = document.getElementById('view-finance');
  const v = state.activeVehicle;
  if (!v) { view.innerHTML = '<div class="empty-state"><h3>Selecione um veículo</h3></div>'; return; }
  const period = state.financePeriod || 'this_month';
  const refuels = filterByPeriod(state.refuels || [], period);
  const maintenances = filterByPeriod(state.maintenances || [], period);
  const expenses = filterByPeriod(state.expenses || [], period);
  const trips = filterByPeriod(state.trips || [], period, 'dataInicio');
  const finances = aggregateFinances({ refuels, maintenances, expenses, trips, odometerKm: Number(v.quilometragemAtual) || 0 });
  view.innerHTML = `
    <div class="page-header"><h1>Financeiro</h1>
      <div class="page-actions"><select id="fin-period">
        <option value="this_week" ${period === 'this_week' ? 'selected' : ''}>Esta semana</option>
        <option value="last_week">Semana passada</option>
        <option value="this_month" ${period === 'this_month' ? 'selected' : ''}>Este mês</option>
        <option value="last_month">Mês passado</option>
        <option value="last_30">Últimos 30 dias</option>
        <option value="last_12">Últimos 12 meses</option>
        <option value="this_year">Este ano</option>
        <option value="last_year">Ano passado</option>
        <option value="all">Tudo</option>
      </select></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="card-title">Total gasto</div><div class="card-value">${formatCurrency(finances.grandTotal)}</div></div>
      <div class="stat-card"><div class="card-title">Combustível</div><div class="card-value">${formatCurrency(finances.refuelTotal)}</div></div>
      <div class="stat-card"><div class="card-title">Manutenção</div><div class="card-value">${formatCurrency(finances.maintenanceTotal)}</div></div>
      <div class="stat-card"><div class="card-title">Despesas</div><div class="card-value">${formatCurrency(finances.expenseTotal)}</div></div>
      <div class="stat-card"><div class="card-title">Viagens</div><div class="card-value">${formatCurrency(finances.tripTotal)}</div></div>
      <div class="stat-card"><div class="card-title">Custo/km</div><div class="card-value">${finances.costPerKm ? formatCurrency(finances.costPerKm) : '—'}</div></div>
      <div class="stat-card"><div class="card-title">Custo/100km</div><div class="card-value">${finances.costPer100km ? formatCurrency(finances.costPer100km) : '—'}</div></div>
    </div>
    <div class="chart-container"><h3>Gastos mensais (12 meses)</h3><div class="chart-wrapper tall"><canvas id="fin-chart-monthly"></canvas></div></div>
    <div class="chart-container"><h3>Gastos por categoria</h3><div class="chart-wrapper"><canvas id="fin-chart-cat"></canvas></div></div>
    <div class="chart-container"><h3>Preço do combustível ao longo do tempo</h3><div class="chart-wrapper"><canvas id="fin-chart-price"></canvas></div></div>
  `;
  document.getElementById('fin-period').addEventListener('change', (e) => {
    state.financePeriod = e.target.value;
    renderFinanceView(state);
  });
  renderFinanceCharts(state);
}

function renderFinanceCharts(state) {
  const { Chart } = state.charts;
  if (!Chart) return;
  const allRecords = [
    ...(state.refuels || []).map(r => ({ data: r.data, valor: Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro), cat: 'Combustível' })),
    ...(state.maintenances || []).map(m => ({ data: m.data, valor: Number(m.valor) || 0, cat: 'Manutenção' })),
    ...(state.expenses || []).map(e => ({ data: e.data, valor: Number(e.valor) || 0, cat: e.categoria })),
  ];
  const monthly = monthlyBreakdown(allRecords).slice(-12);
  const ctxM = document.getElementById('fin-chart-monthly');
  if (ctxM) new Chart(ctxM, { type: 'bar', data: { labels: monthly.map(m => { const [y, mo] = m.key.split('-'); return `${mo}/${y.slice(2)}`; }), datasets: [{ label: 'Gastos', data: monthly.map(m => m.value), backgroundColor: 'rgba(47,110,240,0.7)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  const byCat = expensesByCategory([
    ...(state.refuels || []).map(r => ({ categoria: 'Combustível', valor: Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro) })),
    ...(state.maintenances || []).map(m => ({ categoria: 'Manutenção', valor: Number(m.valor) || 0 })),
    ...(state.expenses || []).map(e => ({ categoria: e.categoria, valor: Number(e.valor) || 0 })),
  ]);
  const ctxC = document.getElementById('fin-chart-cat');
  if (ctxC) new Chart(ctxC, { type: 'doughnut', data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: ['#2f6ef0', '#10b95f', '#f5b400', '#ef4444', '#8ab8ff', '#34d27b', '#cbd5e1', '#ffcf5c'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
  const series = calcRefuelSeries(state.refuels || []);
  const ctxP = document.getElementById('fin-chart-price');
  if (ctxP) new Chart(ctxP, { type: 'line', data: { labels: series.map(r => formatDate(r.data)), datasets: [{ label: 'R$/L', data: series.map(r => Number(r.precoPorLitro)), borderColor: '#10b95f', backgroundColor: 'rgba(16,185,95,0.1)', tension: 0.3 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}
