var Cache = (function () {

  var TTL_SECONDS = 300;

  function get(key) {
    var raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  }

  function set(key, value, ttl) {
    CacheService.getScriptCache().put(key, JSON.stringify(value), ttl || TTL_SECONDS);
  }

  function remove(key) {
    CacheService.getScriptCache().remove(key);
  }

  function getOrSet(key, fn, ttl) {
    var cached = get(key);
    if (cached !== null) return cached;
    var value = fn();
    set(key, value, ttl);
    return value;
  }

  return { get: get, set: set, remove: remove, getOrSet: getOrSet };

})();
