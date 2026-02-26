'use strict';

const common = require('./common');

function privacy (opts) {
  opts.country = opts.country || 'US';

  return new Promise((resolve) => {
    if (opts.id) {
      resolve();
    } else {
      throw Error('Either id or appId is required');
    }
  })
    .then(() => {
      const tokenUrl = `https://apps.apple.com/${opts.country}/app/id${opts.id}`;
      return common.request(tokenUrl, {}, opts.requestOptions);
    })
    .then((html) => {
      // Token is now in the JS bundle, find the script URL first
      const scriptMatch = html.match(/<script[^>]+src="(\/assets\/index[^"]+\.js)"/);
      if (!scriptMatch) {
        throw Error('Could not find app store script bundle URL');
      }
      const scriptUrl = `https://apps.apple.com${scriptMatch[1]}`;
      return common.request(scriptUrl, {}, opts.requestOptions);
    })
    .then((js) => {
      const tokenMatch = js.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/);
      if (!tokenMatch) {
        throw Error('Could not find authorization token in script bundle');
      }
      const token = tokenMatch[0];

      const url = `https://amp-api-edge.apps.apple.com/v1/catalog/${opts.country}/apps/${opts.id}?platform=web&fields=privacyDetails`;
      return common.request(url, {
        'Origin': 'https://apps.apple.com',
        'Authorization': `Bearer ${token}`
      }, opts.requestOptions);
    })
    .then((json) => {
      if (json.length === 0) { throw Error('App not found (404)'); }

      return JSON.parse(json).data[0].attributes.privacyDetails;
    });
}

module.exports = privacy;

