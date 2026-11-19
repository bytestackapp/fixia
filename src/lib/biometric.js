// Fingerprint / face sign-in. Works only inside the Android app.
const native = !!import.meta.env.VITE_NATIVE;
const SERVER = 'ph.fixia.app';
let plugin;
const load = async () => (plugin ||= (await import('capacitor-native-biometric')).NativeBiometric);

export async function biometricSupported() {
  if (!native) return false;
  try { return !!(await (await load()).isAvailable()).isAvailable; } catch { return false; }
}
export async function savedLogin() {
  if (!native) return null;
  try { return await (await load()).getCredentials({ server: SERVER }); } catch { return null; }
}
export async function saveLogin(username, password) {
  await (await load()).setCredentials({ username, password, server: SERVER });
}
export async function clearLogin() {
  try { await (await load()).deleteCredentials({ server: SERVER }); } catch { /* nothing saved */ }
}
// Asks for fingerprint/face, then returns the saved { username, password }. Throws if cancelled or failed.
export async function unlockLogin() {
  const p = await load();
  await p.verifyIdentity({ reason: 'Sign in to Fixia', title: 'Sign in', subtitle: 'Use your fingerprint or face', description: '' });
  return p.getCredentials({ server: SERVER });
}