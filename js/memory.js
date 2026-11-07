/*
  MEMORY: what Casey remembers about you.
  Uses localStorage when available, otherwise keeps it in memory for this tab.
*/
const Memory = (() => {
  const KEY = 'casey.memory.v1';
  let fallback = null;
  const blank = () => ({ name: null, clip: null, last: 0, total: 0 });

  let data = load();

  function load() {
    let s = null;
    try { s = localStorage.getItem(KEY); } catch (e) { s = fallback; }
    if (!s) return blank();
    try { return Object.assign(blank(), JSON.parse(s)); } catch (e) { return blank(); }
  }

  function save() {
    const s = JSON.stringify(data);
    fallback = s;
    try { localStorage.setItem(KEY, s); } catch (e) {}
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    fallback = null;
    data = blank();
  }

  return {
    get: () => data,
    save,
    reset,
    hasName: () => !!data.name
  };
})();
