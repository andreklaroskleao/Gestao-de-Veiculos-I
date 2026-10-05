import { addShare, updateShare, removeShare, listShares, findUserByEmail, getVehicle } from './firestore.js';
import { showToast, confirmDialog, escapeHtml } from './utils.js';
import { validateShare, showFieldErrors } from './validation.js';

export async function loadSharesUI(vehicleId) {
  const shares = await listShares(vehicleId);
  const container = document.getElementById('shares-list');
  if (!container) return;
  if (!shares.length) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum compartilhamento ativo.</p></div>';
    return;
  }
  container.innerHTML = shares.map(s => `
    <div class="card mb-2" data-share="${s.id}">
      <div class="flex justify-between items-center">
        <div>
          <strong>${escapeHtml(s.displayName || s.email)}</strong><br/>
          <span class="muted">${escapeHtml(s.email)}</span>
        </div>
        <div class="flex gap-1 items-center">
          <select class="share-role-select" data-uid="${s.id}">
            <option value="viewer" ${s.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            <option value="editor" ${s.role === 'editor' ? 'selected' : ''}>Editor</option>
          </select>
          <button class="btn btn-danger btn-sm share-remove-btn" data-uid="${s.id}">Remover</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.share-role-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const uid = e.target.dataset.uid;
      await updateShare(vehicleId, uid, e.target.value);
      showToast('Permissão atualizada.', 'success');
    });
  });
  container.querySelectorAll('.share-remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = e.target.dataset.uid;
      if (!confirmDialog('Remover este compartilhamento?')) return;
      await removeShare(vehicleId, uid);
      showToast('Compartilhamento removido.', 'success');
      loadSharesUI(vehicleId);
    });
  });
}

export function initShareForm(vehicleId, ownerUid) {
  const form = document.getElementById('share-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      email: form.email.value.trim().toLowerCase(),
      role: form.role.value,
    };
    const errors = validateShare(data);
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) return;

    const targetUser = await findUserByEmail(data.email);
    if (!targetUser) {
      showToast('Usuário não encontrado. Peça para a pessoa fazer login no app primeiro.', 'error', 6000);
      return;
    }
    if (targetUser.id === ownerUid) {
      showToast('O proprietário não pode ser adicionado como compartilhado.', 'error');
      return;
    }
    await addShare(vehicleId, {
      userId: targetUser.id,
      email: targetUser.email,
      displayName: targetUser.nome || targetUser.email,
      role: data.role,
      createdBy: ownerUid,
    });
    showToast('Veículo compartilhado com sucesso.', 'success');
    form.reset();
    loadSharesUI(vehicleId);
  });
}
