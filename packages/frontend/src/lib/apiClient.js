// Résout l'adresse de l'API : en mode Client, Electron transmet l'adresse
// du serveur distant via ?apiAddress=... (voir packages/desktop/src/main.js).
// En mode Serveur (ou en dev web pur), on retombe sur le serveur local.
const params = new URLSearchParams(window.location.search);
const remoteAddress = params.get("apiAddress");
export const API_BASE = remoteAddress ? `http://${remoteAddress}` : "http://localhost:4000";

const TOKEN_KEY = "ceco_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur ${res.status}`);
  }

  // 204 No Content (ex. DELETE réussi) n'a pas de corps — res.json() planterait
  // en essayant de parser une chaîne vide. Idem si le serveur ne renvoie
  // explicitement aucun contenu (Content-Length: 0).
  if (res.status === 204 || res.headers.get("content-length") === "0") {
    return null;
  }

  return res.json();
}

// Pour les fichiers binaires (ex. logo du centre) : une balise <img src="...">
// ne peut pas envoyer l'en-tête Authorization, donc on récupère le fichier
// via fetch() authentifié et on le transforme en URL locale affichable.
// Pensez à appeler URL.revokeObjectURL(url) quand elle n'est plus utilisée.
export async function apiFetchImageUrl(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}