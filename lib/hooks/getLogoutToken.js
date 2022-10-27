const { promisify } = require('util');
const { getIssuer } = require('../client');

module.exports = async (req, config) => {
  const get = promisify(config.session.store.get).bind(config.session.store);
  const { issuer } = await getIssuer(config);
  const { sid } = req.oidc.user;

  // `sid`s are unique to issuer so we include the issuer in the key.
  return get(`${issuer}|${sid}`);
};
