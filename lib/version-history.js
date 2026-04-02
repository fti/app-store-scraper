'use strict';

const common = require('./common');

let cachedToken = null;

function fetchToken (opts) {
  const tokenUrl = `https://apps.apple.com/${opts.country}/app/id${opts.id}`;

  return common.request(tokenUrl, {}, opts.requestOptions)
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

      return tokenMatch[0];
    });
}

function refreshToken (opts) {
  return fetchToken(opts).then((token) => {
    cachedToken = token;
    return token;
  });
}

function requestVersionHistory (opts, token) {
  const url = `https://amp-api-edge.apps.apple.com/v1/catalog/${opts.country}/apps/${opts.id}?platform=web&extend=versionHistory&additionalPlatforms=appletv,ipad,iphone,mac,realityDevice`;
  return common.request(url, {
    'Origin': 'https://apps.apple.com',
    'Authorization': `Bearer ${token}`
  }, opts.requestOptions);
}

function isUnauthorizedError (error) {
  const statusCode = error && error.response && error.response.statusCode;
  if (statusCode === 401 || statusCode === 403) {
    return true;
  }

  const responseBody = error && error.response && error.response.body;
  const message = `${error && error.message ? error.message : ''} ${responseBody || ''}`.toLowerCase();
  return message.includes('unauthorized') || message.includes('not authorized') || message.includes('forbidden');
}

function versionHistory (opts) {
  opts = opts || {};
  opts.country = opts.country || 'US';

  if (!opts.id) {
    return Promise.reject(Error('Either id or appId is required'));
  }

  const tokenPromise = cachedToken ? Promise.resolve(cachedToken) : refreshToken(opts);

  return tokenPromise
    .then((token) => requestVersionHistory(opts, token)
      .catch((error) => {
        if (!isUnauthorizedError(error)) {
          throw error;
        }

        return refreshToken(opts)
          .then((refreshedToken) => requestVersionHistory(opts, refreshedToken));
      })
    )
    .then((json) => {
      if (json.length === 0) { throw Error('App not found (404)'); }

      return JSON.parse(json).data[0].attributes.platformAttributes.ios.versionHistory;
    });
}

module.exports = versionHistory;

