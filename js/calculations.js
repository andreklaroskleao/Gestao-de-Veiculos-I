import { parseDate } from './utils.js';

export function calcDistance(kmA, kmB) {
  const a = Number(kmA), b = Number(kmB);
  if (!isFinite(a) || !isFinite(b)) return null;
  if (a < 0 || b < 0) return null;
  return Math.max(0, b - a);
}

export function calcConsumption(distance, liters, fullTank, prevFullTank) {
  if (!distance || !liters) return null;
  if (distance <= 0 || liters <= 0) return null;
  if (!fullTank) return null;
  return distance / liters;
}

export function calcCostPerKm(cost, distance) {
  if (!distance || distance <= 0 || !cost) return null;
  return cost / distance;
}

export function calcCostPer100km(costPerKm) {
  if (costPerKm === null || costPerKm === undefined) return null;
  return costPerKm * 100;
}

export function average(values) {
  const valid = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function sum(values) {
  return values.reduce((a, b) => a + (Number(b) || 0), 0);
}

export function calcRefuelSeries(refuels) {
  const sorted = [...refuels].sort((a, b) => {
    const da = parseDate(a.data)?.getTime() || 0;
    const db = parseDate(b.data)?.getTime() || 0;
    if (da !== db) return da - db;
    return Number(a.quilometragem) - Number(b.quilometragem);
  });
  const rows = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const prev = sorted[i - 1] || null;
    const distance = prev ? calcDistance(prev.quilometragem, cur.quilometragem) : null;
    const fullTank = !!cur.tanqueCheio;
    const prevFull = prev ? !!prev.tanqueCheio : false;
    const consumption = (distance !== null && prevFull && fullTank)
      ? calcConsumption(distance, cur.litros, fullTank, prevFull)
      : null;
    const valorTotal = Number(cur.valorTotal) || (Number(cur.litros) * Number(cur.precoPorLitro)) || 0;
    const costPerKm = (distance && valorTotal) ? calcCostPerKm(valorTotal, distance) : null;
    rows.push({
      ...cur,
      _distance: distance,
      _consumption: consumption,
      _valorTotal: valorTotal,
      _costPerKm: costPerKm,
      _index: i,
    });
  }
  return rows;
}

export function refuelSummary(refuels) {
  const series = calcRefuelSeries(refuels);
  const fullRows = series.filter(r => r._consumption !== null);
  const consumptions = fullRows.map(r => r._consumption);
  const totalLiters = sum(refuels.map(r => Number(r.litros)));
  const totalSpent = sum(refuels.map(r => Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro)));
  const totalDistance = series.length ? calcDistance(series[0].quilometragem, series[series.length - 1].quilometragem) : 0;
  return {
    series,
    avgConsumption: average(consumptions),
    bestConsumption: consumptions.length ? Math.max(...consumptions) : null,
    worstConsumption: consumptions.length ? Math.min(...consumptions) : null,
    totalLiters,
    totalSpent,
    totalDistance,
    refuelCount: refuels.length,
    avgPrice: average(refuels.map(r => Number(r.precoPorLitro))),
    overallCostPerKm: totalDistance ? totalSpent / totalDistance : null,
  };
}

export function consumptionByFuel(refuels) {
  const series = calcRefuelSeries(refuels);
  const byFuel = {};
  for (const r of series) {
    if (r._consumption === null) continue;
    if (!byFuel[r.combustivel]) byFuel[r.combustivel] = { consumptions: [], prices: [] };
    byFuel[r.combustivel].consumptions.push(r._consumption);
    byFuel[r.combustivel].prices.push(Number(r.precoPorLitro));
  }
  const result = [];
  for (const [fuel, data] of Object.entries(byFuel)) {
    const avgCons = average(data.consumptions);
    const avgPrice = average(data.prices);
    result.push({
      fuel,
      avgConsumption: avgCons,
      avgPrice,
      costPerKm: avgCons && avgPrice ? avgPrice / avgCons : null,
      costPer100km: avgCons && avgPrice ? (avgPrice / avgCons) * 100 : null,
      count: data.consumptions.length,
    });
  }
  return result.sort((a, b) => (a.costPerKm || Infinity) - (b.costPerKm || Infinity));
}

export function compareFuels(fuelData) {
  if (!fuelData.length) return { best: null, ranked: [] };
  const ranked = [...fuelData].sort((a, b) => (a.costPerKm || Infinity) - (b.costPerKm || Infinity));
  return { best: ranked[0], ranked };
}

export function expensesByCategory(expenses) {
  const byCat = {};
  for (const e of expenses) {
    const cat = e.categoria || 'outros';
    byCat[cat] = (byCat[cat] || 0) + (Number(e.valor) || 0);
  }
  return byCat;
}

export function filterByPeriod(records, periodKey, dateField = 'data') {
  if (periodKey === 'all' || !periodKey) return records;
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (periodKey) {
    case 'this_week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case 'last_week': {
      const day = now.getDay();
      start.setDate(now.getDate() - day - 7);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime() + 6 * 86400000);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case 'this_month':
      start.setDate(1); start.setHours(0, 0, 0, 0);
      break;
    case 'last_month':
      start.setMonth(now.getMonth() - 1); start.setDate(1); start.setHours(0, 0, 0, 0);
      end.setDate(0); end.setHours(23, 59, 59, 999);
      break;
    case 'last_30':
      start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
      break;
    case 'last_12':
      start.setFullYear(now.getFullYear() - 1); start.setHours(0, 0, 0, 0);
      break;
    case 'this_year':
      start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0);
      break;
    case 'last_year':
      start.setFullYear(now.getFullYear() - 1); start.setMonth(0); start.setDate(1); start.setHours(0, 0, 0, 0);
      end.setFullYear(now.getFullYear() - 1); end.setMonth(11); end.setDate(31); end.setHours(23, 59, 59, 999);
      break;
    default:
      return records;
  }
  return records.filter(r => {
    const d = parseDate(r[dateField]);
    if (!d) return false;
    return d >= start && d <= end;
  });
}

export function filterByDateRange(records, startDate, endDate, dateField = 'data') {
  if (!startDate && !endDate) return records;
  const s = startDate ? new Date(startDate) : null;
  const e = endDate ? new Date(endDate) : null;
  if (e) e.setHours(23, 59, 59, 999);
  return records.filter(r => {
    const d = parseDate(r[dateField]);
    if (!d) return false;
    if (s && d < s) return false;
    if (e && d > e) return false;
    return true;
  });
}

export function monthlyBreakdown(records, dateField = 'data') {
  const byMonth = {};
  for (const r of records) {
    const d = parseDate(r[dateField]);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + (Number(r.valor) || 0);
  }
  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ key, value }));
}

export function aggregateFinances({ refuels, maintenances, expenses, trips, odometerKm }) {
  const refuelTotal = sum(refuels.map(r => Number(r.valorTotal) || Number(r.litros) * Number(r.precoPorLitro)));
  const maintenanceTotal = sum(maintenances.map(m => Number(m.valor) || 0));
  const expenseTotal = sum(expenses.map(e => Number(e.valor) || 0));
  const tripTotal = sum(trips.map(t => Number(t._totalCost) || 0));
  const grandTotal = refuelTotal + maintenanceTotal + expenseTotal + tripTotal;
  const distance = odometerKm;
  const costPerKm = distance ? grandTotal / distance : null;
  return {
    refuelTotal, maintenanceTotal, expenseTotal, tripTotal,
    grandTotal, distance, costPerKm,
    costPer100km: costPerKm ? costPerKm * 100 : null,
  };
}

export function weeklyAverage(total, weeks) {
  if (!weeks) return null;
  return total / weeks;
}

export function monthlyAverage(total, months) {
  if (!months) return null;
  return total / months;
}

export function tireLifeKm(tireRecords, currentKm) {
  const purchase = tireRecords.find(t => (t.categoria || t.servico || '').toLowerCase().includes('compra') || (t.servico || '').toLowerCase().includes('troca'));
  if (!purchase || !currentKm) return null;
  const startKm = Number(purchase.quilometragem);
  if (!startKm) return null;
  return currentKm - startKm;
}

export function formatConsumption(value) {
  if (value === null || value === undefined) return 'Aguardando dados suficientes.';
  return `${value.toFixed(1)} km/L`;
}

export function formatCostPerKm(value) {
  if (value === null || value === undefined) return '—';
  return `R$ ${value.toFixed(2)}/km`;
}
