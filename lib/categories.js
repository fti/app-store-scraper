'use strict';

const constants = require('./constants');

function categories () {
  return Promise.resolve(Object.entries(constants.category).map(([name, id]) => ({ name, id })));
}

module.exports = categories;
