'use strict';

const request = require('request');
const minimatch = require('minimatch');
const chalk = require('chalk');

module.exports = (logger, options, paths) => {
  const ENDPOINT_PATTERN_MAP = {
    'skins/images': ['**/skins/**/images/**'],
    skins: ['**/skins/**'],
    quilts: ['**/quilts/**'],
    layouts: ['**/layouts/**'],
    orders: ['**/orders/**'],
    features: ['**/feature/*.xml'],
    forms: ['**/forms/**'],
    lang: ['**/lang/**', '**/*.text.*.json'],
    components: ['**/components/**'],
    scripts: ['**/*.{js,tpl.html}', '**/sdk.conf.json', '**/dependencies.json']
  };

  function createReloadQuery(path) {
    var query = {};
    var found = false;

    Object.keys(ENDPOINT_PATTERN_MAP).forEach(key => {
      if (found) {
        return;
      }
      ENDPOINT_PATTERN_MAP[key].forEach(pattern => {
        if (minimatch(path, pattern)) {
          query[key] = found = true;
        }
      });
    });

    if (!found) {
      query.all = true;
    }

    return query;
  }

  function refreshPlugin(path) {
    const reload = createReloadQuery(path);

    return new Promise((fufill, reject) => {
      logger.debug('Reloading plugin asset URL:', paths.pluginReloadUrl);
      request({
        url: paths.pluginReloadUrl,
        qs: reload.all ? { all: true } : reload,
        json: true,
        port: options.https ? options.httpsPort : options.httpPort
      }, (error, res) => {
        if (error) {
          reject(new Error(`Failed to reload plugin: ${error}`));
        } else if (res.statusCode === 200 && res.body.hasOwnProperty('reloaded')) {
          logger.info('Success! Changes have been applied to ' + chalk.cyan(options.hostname) + '. Plugin cache cleared for:', res.body.reloaded, true);
          fufill(path);
        } else {
          reject(new Error(`Unable to reload plugin, please make sure you have enabled the enable.ExperimentalApi in the app config.`));
        }
      });
    });
  }

  return {
    refreshPlugin
  };
};
