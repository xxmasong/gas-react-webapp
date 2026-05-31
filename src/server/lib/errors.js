var ErrorCode = {
  VALIDATION:   'VALIDATION_ERROR',
  NOT_FOUND:    'NOT_FOUND',
  CONFLICT:     'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL:     'INTERNAL_ERROR',
};

var AppError = (function () {

  var create = (code, message, meta) => {
    var err  = new Error(message);
    err.code = code;
    err.meta = meta || {};
    return err;
  };

  return {
    validation:   (msg, meta)  => create(ErrorCode.VALIDATION,   msg, meta),
    notFound:     (entity, id) => create(ErrorCode.NOT_FOUND,    entity + ' not found: ' + id, { entity: entity, id: id }),
    conflict:     (msg, meta)  => create(ErrorCode.CONFLICT,     msg, meta),
    unauthorized: (msg)        => create(ErrorCode.UNAUTHORIZED, msg),
    internal:     (msg, cause) => create(ErrorCode.INTERNAL,     msg, { cause: String(cause) }),
    isAppError:   (err)        => err instanceof Error && !!err.code,
  };

})();
