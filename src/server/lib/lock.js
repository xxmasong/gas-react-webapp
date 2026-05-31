var Lock = (function () {

  var withLock = (fn) => {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  };

  return { withLock: withLock };

})();
