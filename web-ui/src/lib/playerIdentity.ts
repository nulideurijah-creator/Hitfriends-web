const PLAYER_ID_KEY = "dpy_player_id";
const PLAYER_NAME_KEY = "dpy_player_name";

export type LocalPlayerIdentity = {
  id: string;
  name: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createName(id: string) {
  return `玩家${id.slice(0, 4).toUpperCase()}`;
}

export function getLocalPlayerIdentity(): LocalPlayerIdentity {
  let id = localStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = createId();
    localStorage.setItem(PLAYER_ID_KEY, id);
  }

  let name = localStorage.getItem(PLAYER_NAME_KEY);
  if (!name) {
    name = createName(id);
    localStorage.setItem(PLAYER_NAME_KEY, name);
  }

  return { id, name };
}

export function renameLocalPlayer(name: string) {
  const normalized = name.trim().slice(0, 16);
  if (normalized) localStorage.setItem(PLAYER_NAME_KEY, normalized);
  return getLocalPlayerIdentity();
}
