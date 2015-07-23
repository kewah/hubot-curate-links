module.exports = function(type, config) {
  return require('./adapters/' + type)(config);
};
