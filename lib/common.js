'use strict';

const got = require('got');
const debug = require('debug')('app-store-scraper');
const c = require('./constants');
const { parseISO, format } = require('date-fns');

function cleanApp (app) {
  let released = parseISO(app.releaseDate);
  let updated = parseISO(app.currentVersionReleaseDate || app.releaseDate);
  released = format(released, 'MMM dd, yyyy');
  updated = updated.getTime();
  return {
    id: app.trackId,
    appId: app.trackId,
    bundleId: app.bundleId,
    title: app.trackName,
    url: app.trackViewUrl,
    description: app.description,
    icon: app.artworkUrl512 || app.artworkUrl100 || app.artworkUrl60,
    genres: app.genres,
    genreIds: app.genreIds,
    primaryGenre: app.primaryGenreName,
    primaryGenreId: app.primaryGenreId,
    contentRating: app.contentAdvisoryRating,
    languages: app.languageCodesISO2A,
    size: app.fileSizeBytes,
    requiredOsVersion: app.minimumOsVersion,
    released,
    updated,
    releaseNotes: app.releaseNotes,
    version: app.version,
    price: app.price,
    currency: app.currency,
    free: app.price === 0,
    developerId: app.artistId,
    developer: app.artistName,
    developerUrl: app.artistViewUrl,
    developerWebsite: app.sellerUrl,
    score: app.averageUserRating,
    ratings: app.userRatingCount,
    currentVersionScore: app.averageUserRatingForCurrentVersion,
    currentVersionReviews: app.userRatingCountForCurrentVersion,
    screenshots: app.screenshotUrls,
    ipadScreenshots: app.ipadScreenshotUrls,
    appletvScreenshots: app.appletvScreenshotUrls,
    supportedDevices: app.supportedDevices
  };
}

// Sliding window rate limiter
const requestTimestamps = [];

async function throttle (limit) {
  if (!limit) { return; }

  const now = Date.now();
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] >= 1000) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= limit) {
    const waitTime = 1000 - (now - requestTimestamps[0]) + 1;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    return throttle(limit);
  }

  requestTimestamps.push(Date.now());
}

// TODO add an optional parse function
const doRequest = async (url, headers, requestOptions, limit) => {
  debug('Making request: %s %j %o', url, headers, requestOptions);

  await throttle(limit);

  const { agent, method, ...restOptions } = requestOptions || {};

  const gotOptions = {
    method: method || 'GET',
    headers,
    ...restOptions
  };

  if (agent) {
    gotOptions.agent = { http: agent, https: agent };
  }

  try {
    const response = await got(url, gotOptions);
    debug('Finished request');
    return response.body;
  } catch (error) {
    debug('Request error', error);
    if (error.response) {
      const err = new Error(error.message);
      err.response = error.response;
      throw err;
    }
    throw error;
  }
};

const LOOKUP_URL = 'https://itunes.apple.com/lookup';

function lookup (ids, idField, country, lang, requestOptions, limit) {
  idField = idField || 'id';
  country = country || 'us';
  const langParam = lang ? `&lang=${lang}` : '';
  const joinedIds = ids.join(',');
  const url = `${LOOKUP_URL}?${idField}=${joinedIds}&country=${country}&entity=software${langParam}`;
  return doRequest(url, {}, requestOptions, limit)
    .then(JSON.parse)
    .then((res) => res.results.filter(function (app) {
      return typeof app.wrapperType === 'undefined' || app.wrapperType === 'software';
    }))
    .then((res) => res.map(cleanApp));
}

function storeId (countryCode) {
  const markets = c.markets;
  const defaultStore = '143441';
  return (countryCode && markets[countryCode.toUpperCase()]) || defaultStore;
}

module.exports = { cleanApp, lookup, request: doRequest, storeId };
