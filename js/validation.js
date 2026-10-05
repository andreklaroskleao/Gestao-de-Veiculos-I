export function validateRequired(value, label) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return `${label} é obrigatório.`;
  }
  return null;
}

export function validateNumber(value, label, { min = null, max = null, allowZero = true } = {}) {
  const n = Number(value);
  if (value === '' || value === null || value === undefined) {
    return `${label} é obrigatório.`;
  }
  if (isNaN(n)) return `${label} deve ser um número válido.`;
  if (!allowZero && n === 0) return `${label} deve ser maior que zero.`;
  if (min !== null && n < min) return `${label} deve ser maior ou igual a ${min}.`;
  if (max !== null && n > max) return `${label} deve ser menor ou igual a ${max}.`;
  return null;
}

export function validatePositiveNumber(value, label) {
  return validateNumber(value, label, { min: 0, allowZero: false });
}

export function validateDate(value, label = 'Data') {
  if (!value) return `${label} é obrigatória.`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return `${label} inválida.`;
  return null;
}

export function validateDateRange(start, end) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (s > e) return 'Data final deve ser maior ou igual à data inicial.';
  return null;
}

export function validateOdometer(value, lastKm) {
  const err = validateNumber(value, 'Quilometragem', { min: 0 });
  if (err) return err;
  if (lastKm !== null && lastKm !== undefined && Number(value) < Number(lastKm)) {
    return `Quilometragem não pode ser menor que a atual (${lastKm} km).`;
  }
  return null;
}

export function validateVehicle(data) {
  const errors = {};
  const nome = validateRequired(data.nome, 'Nome/Apelido');
  if (nome) errors.nome = nome;
  const marca = validateRequired(data.marca, 'Marca');
  if (marca) errors.marca = marca;
  const modelo = validateRequired(data.modelo, 'Modelo');
  if (modelo) errors.modelo = modelo;
  if (data.ano) {
    const ano = validateNumber(data.ano, 'Ano', { min: 1900, max: new Date().getFullYear() + 1 });
    if (ano) errors.ano = ano;
  }
  if (data.capacidadeTanque) {
    const cap = validateNumber(data.capacidadeTanque, 'Capacidade do tanque', { min: 0 });
    if (cap) errors.capacidadeTanque = cap;
  }
  if (data.quilometragemAtual !== '' && data.quilometragemAtual !== undefined) {
    const km = validateNumber(data.quilometragemAtual, 'Quilometragem atual', { min: 0 });
    if (km) errors.quilometragemAtual = km;
  }
  return errors;
}

export function validateRefuel(data, lastKm) {
  const errors = {};
  const data_err = validateDate(data.data, 'Data');
  if (data_err) errors.data = data_err;
  const km = validateOdometer(data.quilometragem, lastKm);
  if (km) errors.quilometragem = km;
  const litros = validatePositiveNumber(data.litros, 'Litros');
  if (litros) errors.litros = litros;
  const preco = validatePositiveNumber(data.precoPorLitro, 'Preço por litro');
  if (preco) errors.precoPorLitro = preco;
  const combustivel = validateRequired(data.combustivel, 'Combustível');
  if (combustivel) errors.combustivel = combustivel;
  return errors;
}

export function validateMaintenance(data) {
  const errors = {};
  const data_err = validateDate(data.data, 'Data');
  if (data_err) errors.data = data_err;
  const serv = validateRequired(data.servico, 'Serviço');
  if (serv) errors.servico = serv;
  if (data.valor !== '' && data.valor !== undefined) {
    const v = validateNumber(data.valor, 'Valor', { min: 0 });
    if (v) errors.valor = v;
  }
  if (data.proximaQuilometragem && data.quilometragem) {
    if (Number(data.proximaQuilometragem) <= Number(data.quilometragem)) {
      errors.proximaQuilometragem = 'Próxima quilometragem deve ser maior que a atual.';
    }
  }
  return errors;
}

export function validateExpense(data) {
  const errors = {};
  const data_err = validateDate(data.data, 'Data');
  if (data_err) errors.data = data_err;
  const cat = validateRequired(data.categoria, 'Categoria');
  if (cat) errors.categoria = cat;
  const valor = validatePositiveNumber(data.valor, 'Valor');
  if (valor) errors.valor = valor;
  return errors;
}

export function validateTrip(data) {
  const errors = {};
  const di = validateDate(data.dataInicio, 'Data de início');
  if (di) errors.dataInicio = di;
  if (data.dataFim) {
    const df = validateDate(data.dataFim, 'Data de fim');
    if (df) errors.dataFim = df;
    const range = validateDateRange(data.dataInicio, data.dataFim);
    if (range) errors.dataFim = range;
  }
  const origem = validateRequired(data.origem, 'Origem');
  if (origem) errors.origem = origem;
  const destino = validateRequired(data.destino, 'Destino');
  if (destino) errors.destino = destino;
  const ki = validateNumber(data.kmInicial, 'KM inicial', { min: 0 });
  if (ki) errors.kmInicial = ki;
  const kf = validateNumber(data.kmFinal, 'KM final', { min: 0 });
  if (kf) errors.kmFinal = kf;
  if (!ki && !kf && Number(data.kmFinal) < Number(data.kmInicial)) {
    errors.kmFinal = 'KM final deve ser maior ou igual ao inicial.';
  }
  return errors;
}

export function validateShare(data) {
  const errors = {};
  const email = validateRequired(data.email, 'E-mail');
  if (email) errors.email = email;
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
    errors.email = 'E-mail inválido.';
  }
  const role = validateRequired(data.role, 'Permissão');
  if (role) errors.role = role;
  else if (!['editor', 'viewer'].includes(data.role)) {
    errors.role = 'Permissão inválida.';
  }
  return errors;
}

export function showFieldErrors(form, errors) {
  form.querySelectorAll('.error-msg').forEach(el => el.remove());
  form.querySelectorAll('.form-group').forEach(g => g.classList.remove('invalid'));
  Object.entries(errors).forEach(([field, msg]) => {
    const input = form.querySelector(`[name="${field}"]`);
    if (input) {
      const group = input.closest('.form-group');
      if (group) {
        group.classList.add('invalid');
        const errEl = document.createElement('div');
        errEl.className = 'error-msg';
        errEl.textContent = msg;
        group.appendChild(errEl);
      }
    }
  });
}

export function clearFieldErrors(form) {
  form.querySelectorAll('.error-msg').forEach(el => el.remove());
  form.querySelectorAll('.form-group').forEach(g => g.classList.remove('invalid'));
}
