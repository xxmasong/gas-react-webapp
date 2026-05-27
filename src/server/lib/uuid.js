var Uuid = (function () {

  function generate() {
    return Utilities.getUuid();
  }

  return { generate: generate };

})();
