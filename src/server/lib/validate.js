// Depends on AppError (errors.js). Both are always loaded together.

var validate = (function () {

  function required(value, name) {
    if (value === undefined || value === null)
      throw AppError.validation(name + ' is required');
  }

  function string(value, name) {
    required(value, name);
    if (typeof value !== 'string' || value.trim() === '')
      throw AppError.validation(name + ' must be a non-empty string');
  }

  function nonNegativeNumber(value, name) {
    var n = Number(value);
    if (isNaN(n) || n < 0)
      throw AppError.validation(name + ' must be a non-negative number');
  }

  function uuid(value, name) {
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(String(value)))
      throw AppError.validation(name + ' must be a valid UUID');
  }

  return { required: required, string: string, nonNegativeNumber: nonNegativeNumber, uuid: uuid };

})();
