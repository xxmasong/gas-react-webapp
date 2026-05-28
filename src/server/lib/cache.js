var Cache = (function () {

  var TTL_SECONDS = 300;

  function get(key) {
    var raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  }

  // CacheService rejects values over 100KB per key with
  // "Argument too large: value". Caching is only an optimization, so if a
  // payload is too big we skip it (and clear any stale entry) instead of
  // letting the write blow up the whole request.
  var MAX_VALUE_BYTES = 100 * 1024;

  function set(key, value, ttl) {
    var json = JSON.stringify(value);
    if (json.length > MAX_VALUE_BYTES) {
      CacheService.getScriptCache().remove(key);
      return;
    }
    try {
      CacheService.getScriptCache().put(key, json, ttl || TTL_SECONDS);
    } catch (e) {
      // Size estimate can differ from CacheService's own (UTF-8 bytes vs.
      // string length); never let a cache write fail the operation.
      CacheService.getScriptCache().remove(key);
    }
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
