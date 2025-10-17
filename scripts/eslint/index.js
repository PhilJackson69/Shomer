const requireApiFetchOnWrite = require('./rules/require-api-fetch-on-write');

module.exports = {
  rules: {
    'require-api-fetch-on-write': requireApiFetchOnWrite
  }
};
