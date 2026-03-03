export function securityPolicy(req, _res, next) {
  req.isReadOnly = false;
  next();
}
