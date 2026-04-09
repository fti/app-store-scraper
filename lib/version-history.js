'use strict';

const common = require('./common');

function requestVersionHistory (opts) {
  const url = `https://apps.apple.com/api/apps/v1/catalog/${opts.country}/apps/${opts.id}?platform=web&extend=versionHistory&additionalPlatforms=appletv,ipad,iphone,mac,realityDevice`;
  return common.request(url, {
    'Origin': 'https://apps.apple.com'
  }, opts.requestOptions);
}

function versionHistory (opts) {
  opts = opts || {};
  opts.country = opts.country || 'US';

  if (!opts.id) {
    return Promise.reject(Error('Either id or appId is required'));
  }

  return requestVersionHistory(opts)
    .then((json) => {
      if (json.length === 0) { throw Error('App not found (404)'); }

      return JSON.parse(json).data[0].attributes.platformAttributes.ios.versionHistory;
    });
}

module.exports = versionHistory;

