import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from './firebase-init.js';
import { upsertUser } from './firestore.js';

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await upsertUser({
    uid: user.uid,
    nome: user.displayName || '',
    email: user.email || '',
    foto: user.photoURL || '',
  });
  return user;
}

export async function logout() {
  await signOut(auth);
  localStorage.removeItem('gv_active_vehicle');
  localStorage.removeItem('gv_role');
  window.location.href = '/index.html';
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() {
  return auth.currentUser;
}
