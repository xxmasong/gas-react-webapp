var ErrorCode = {
  VALIDATION:   'VALIDATION_ERROR',
  NOT_FOUND:    'NOT_FOUND',
  CONFLICT:     'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL:     'INTERNAL_ERROR',
};

var AppError = (function () {

  function create(code, message, meta) {
    var err  = new Error(message);
    err.code = code;
    err.meta = meta || {};
    return err;
  }

  return {
    validation:   function (msg, meta)  { return create(ErrorCode.VALIDATION,   msg, meta); },
    notFound:     function (entity, id) { return create(ErrorCode.NOT_FOUND,    entity + ' not found: ' + id, { entity: entity, id: id }); },
    conflict:     function (msg, meta)  { return create(ErrorCode.CONFLICT,     msg, meta); },
    unauthorized: function (msg)        { return create(ErrorCode.UNAUTHORIZED, msg); },
    internal:     function (msg, cause) { return create(ErrorCode.INTERNAL,     msg, { cause: String(cause) }); },
    isAppError:   function (err)        { return err instanceof Error && !!err.code; },
  };

})();
