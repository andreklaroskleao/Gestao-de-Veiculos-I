import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase-init.js';
import { dateToISO, parseDate } from './utils.js';

function withMeta(data, isCreate) {
  const meta = isCreate
    ? { createdAt: serverTimestamp(), createdBy: currentUid() }
    : { updatedAt: serverTimestamp() };
  return { ...data, ...meta };
}

let _uidResolver = () => null;
export function setUidResolver(fn) { _uidResolver = fn; }
function currentUid() { return _uidResolver() || 'unknown'; }

export async function upsertUser({ uid, nome, email, foto }) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { uid, nome, email, foto, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  } else {
    const existing = snap.data();
    const updates = { updatedAt: serverTimestamp() };
    if (nome && existing.nome !== nome) updates.nome = nome;
    if (email && existing.email !== email) updates.email = email;
    if (foto !== undefined && existing.foto !== foto) updates.foto = foto;
    await updateDoc(ref, updates);
  }
}

export async function getUser(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function findUserByEmail(email) {
  const q = query(collection(db, 'users'), where('email', '==', String(email).trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function createVehicle(data) {
  const ref = collection(db, 'vehicles');
  const payload = withMeta({ ...data, ownerId: currentUid() }, true);
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

export async function updateVehicle(id, data) {
  const ref = doc(db, 'vehicles', id);
  const forbidden = ['ownerId', 'createdAt', 'createdBy'];
  const clean = Object.fromEntries(Object.entries(data).filter(([k]) => !forbidden.includes(k)));
  await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
}

export async function deleteVehicle(id) {
  const batch = writeBatch(db);
  const subcollections = ['refuels', 'maintenances', 'expenses', 'trips', 'odometerHistory', 'shares'];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'vehicles', id, sub));
    snap.forEach(d => batch.delete(d.ref));
    if (sub === 'trips') {
      for (const t of snap.docs) {
        const expSnap = await getDocs(collection(db, 'vehicles', id, 'trips', t.id, 'expenses'));
        expSnap.forEach(e => batch.delete(e.ref));
      }
    }
  }
  batch.delete(doc(db, 'vehicles', id));
  await batch.commit();
}

export async function getVehicle(id) {
  const ref = doc(db, 'vehicles', id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listVehicles(uid) {
  const owned = query(collection(db, 'vehicles'), where('ownerId', '==', uid));
  const ownedSnap = await getDocs(owned);
  const vehicles = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), role: 'owner' }));

  const shares = query(collectionGroup(db, 'shares'), where('userId', '==', uid));
  const sharesSnap = await getDocs(shares);
  for (const s of sharesSnap.docs) {
    const vehicleId = s.ref.parent.parent.id;
    if (vehicles.find(v => v.id === vehicleId)) continue;
    const v = await getVehicle(vehicleId);
    if (v) vehicles.push({ ...v, role: s.data().role });
  }
  return vehicles;
}

export async function getShare(vehicleId, userId) {
  const ref = doc(db, 'vehicles', vehicleId, 'shares', userId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listShares(vehicleId) {
  const snap = await getDocs(collection(db, 'vehicles', vehicleId, 'shares'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addShare(vehicleId, { userId, email, displayName, role, createdBy }) {
  const ref = doc(db, 'vehicles', vehicleId, 'shares', userId);
  await setDoc(ref, { userId, email, displayName, role, createdBy, createdAt: serverTimestamp() });
}

export async function updateShare(vehicleId, userId, role) {
  const ref = doc(db, 'vehicles', vehicleId, 'shares', userId);
  await updateDoc(ref, { role, updatedAt: serverTimestamp() });
}

export async function removeShare(vehicleId, userId) {
  await deleteDoc(doc(db, 'vehicles', vehicleId, 'shares', userId));
}

export async function getRole(vehicleId, uid) {
  const v = await getVehicle(vehicleId);
  if (!v) return null;
  if (v.ownerId === uid) return 'owner';
  const share = await getShare(vehicleId, uid);
  return share ? share.role : null;
}

function subPath(vehicleId, sub) { return collection(db, 'vehicles', vehicleId, sub); }

export async function listRecords(vehicleId, sub, opts = {}) {
  let q = subPath(vehicleId, sub);
  const constraints = [];
  if (opts.orderBy) constraints.push(orderBy(opts.orderBy, opts.orderDir || 'desc'));
  if (opts.where) {
    for (const w of opts.where) constraints.push(where(w[0], w[1], w[2]));
  }
  const finalQ = constraints.length ? query(q, ...constraints) : q;
  const snap = await getDocs(finalQ);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createRecord(vehicleId, sub, data) {
  const payload = withMeta(data, true);
  const ref = await addDoc(subPath(vehicleId, sub), payload);
  return ref.id;
}

export async function updateRecord(vehicleId, sub, id, data) {
  const ref = doc(db, 'vehicles', vehicleId, sub, id);
  const forbidden = ['createdAt', 'createdBy', 'ownerId'];
  const clean = Object.fromEntries(Object.entries(data).filter(([k]) => !forbidden.includes(k)));
  await updateDoc(ref, { ...clean, updatedAt: serverTimestamp() });
}

export async function deleteRecord(vehicleId, sub, id) {
  await deleteDoc(doc(db, 'vehicles', vehicleId, sub, id));
}

export async function listTripExpenses(vehicleId, tripId) {
  const snap = await getDocs(collection(db, 'vehicles', vehicleId, 'trips', tripId, 'expenses'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createTripExpense(vehicleId, tripId, data) {
  const payload = withMeta(data, true);
  const ref = await addDoc(collection(db, 'vehicles', vehicleId, 'trips', tripId, 'expenses'), payload);
  return ref.id;
}

export async function deleteTripExpense(vehicleId, tripId, id) {
  await deleteDoc(doc(db, 'vehicles', vehicleId, 'trips', tripId, 'expenses', id));
}

export { collectionGroup };
