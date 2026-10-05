import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatNumber, formatDate, parseDate } from './utils.js';
import { aggregateFinances, refuelSummary, consumptionByFuel } from './calculations.js';

function addHeader(doc, title, vehicleName, periodLabel) {
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Gestão Veicular', 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text(title, 14, 26);
  if (vehicleName) {
    doc.setFontSize(10);
    doc.text(`Veículo: ${vehicleName}`, 14, 33);
  }
  if (periodLabel) {
    doc.text(`Período: ${periodLabel}`, 14, vehicleName ? 40 : 33);
  }
  doc.setDrawColor(226, 232, 240);
  doc.line(14, vehicleName && periodLabel ? 45 : 38, 196, vehicleName && periodLabel ? 45 : 38);
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const now = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em ${now}`, 14, 290);
    doc.text(`Página ${i} de ${pageCount}`, 180, 290);
  }
}

function summaryTable(doc, startY, rows) {
  autoTable(doc, {
    startY,
    head: [['Indicador', 'Valor']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: [31, 86, 212], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 60, halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  return doc.lastAutoTable.finalY;
}

export function generateReportPDF({ vehicle, periodLabel, finances, refuels, maintenances, expenses, trips, sections }) {
  const doc = new jsPDF();
  addHeader(doc, 'Relatório Completo', vehicle?.nome || vehicle?.modelo, periodLabel);

  let y = vehicle && periodLabel ? 52 : vehicle || periodLabel ? 45 : 38;

  if (sections.includes('resumo')) {
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo Financeiro', 14, y + 4);
    y += 8;
    const rows = [
      ['Total gasto', formatCurrency(finances.grandTotal)],
      ['Combustível', formatCurrency(finances.refuelTotal)],
      ['Manutenção', formatCurrency(finances.maintenanceTotal)],
      ['Despesas', formatCurrency(finances.expenseTotal)],
      ['Viagens', formatCurrency(finances.tripTotal)],
      ['Custo por km', finances.costPerKm ? formatCurrency(finances.costPerKm) : '—'],
      ['Custo por 100 km', finances.costPer100km ? formatCurrency(finances.costPer100km) : '—'],
    ];
    y = summaryTable(doc, y, rows) + 8;
  }

  if (sections.includes('abastecimentos') && refuels?.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('Abastecimentos', 14, y + 4);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'KM', 'Combustível', 'Litros', 'R$/L', 'Total', 'km/L']],
      body: refuels.map(r => [
        formatDate(r.data),
        formatNumber(r.quilometragem, 0),
        r.combustivel,
        formatNumber(r.litros),
        formatCurrency(r.precoPorLitro),
        formatCurrency(r.valorTotal || r.litros * r.precoPorLitro),
        r._consumption ? formatNumber(r._consumption, 1) : '—',
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 86, 212], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (sections.includes('consumo')) {
    const byFuel = consumptionByFuel(refuels || []);
    if (byFuel.length) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.text('Comparação de Combustíveis', 14, y + 4);
      y += 8;
      autoTable(doc, {
        startY: y,
        head: [['Combustível', 'Consumo médio (km/L)', 'Preço médio (R$/L)', 'Custo/km', 'Custo/100km']],
        body: byFuel.map(f => [
          f.fuel,
          f.avgConsumption ? formatNumber(f.avgConsumption, 1) : '—',
          f.avgPrice ? formatCurrency(f.avgPrice) : '—',
          f.costPerKm ? formatCurrency(f.costPerKm) : '—',
          f.costPer100km ? formatCurrency(f.costPer100km) : '—',
        ]),
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 95], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }
  }

  if (sections.includes('manutencao') && maintenances?.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('Manutenções', 14, y + 4);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'KM', 'Categoria', 'Serviço', 'Valor']],
      body: maintenances.map(m => [
        formatDate(m.data),
        formatNumber(m.quilometragem, 0),
        m.categoria,
        m.servico,
        formatCurrency(m.valor),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [245, 180, 0], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (sections.includes('despesas') && expenses?.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('Despesas', 14, y + 4);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Categoria', 'Descrição', 'Valor']],
      body: expenses.map(e => [
        formatDate(e.data),
        e.categoria,
        e.descricao || '',
        formatCurrency(e.valor),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  if (sections.includes('viagens') && trips?.length) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text('Viagens', 14, y + 4);
    y += 8;
    autoTable(doc, {
      startY: y,
      head: [['Início', 'Fim', 'Origem', 'Destino', 'Distância', 'Custo']],
      body: trips.map(t => [
        formatDate(t.dataInicio),
        formatDate(t.dataFim),
        t.origem,
        t.destino,
        formatNumber(t._distance || (t.kmFinal - t.kmInicial), 0) + ' km',
        formatCurrency(t._totalCost || 0),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [31, 86, 212], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
  }

  addFooter(doc);
  const filename = `relatorio_${vehicle?.nome || 'veiculo'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}
