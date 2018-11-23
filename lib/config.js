'use strict';

const extend = require('node.extend');
const request = require('request');
const inquirer = require('inquirer');
const fs = require('fs-promise');
const chalk = require('chalk');
const error = require('./error');

let errorHandler;
let logger;
let overrides;
let user = process.env['USER'];
user = user != undefined ? user.replace('.', '_') : undefined;

const RESPONSIVE_VERSION_PATH_MAP = {
  '1': 'v1-lia15.8',
  '1.0': 'v1-lia15.8',
  '1.1': 'v1.1-lia15.9',
  '1.2': 'v1.2-lia15.10',
  '1.3': 'v1.3-lia15.11',
  '1.4': 'v1.4-lia15.12',
  '1.5': 'v1.5-lia16.0',
  '1.6': 'v1.6-lia16.1',
  '1.7': 'v1.7-lia16.2',
  '1.8': 'v1.8-lia16.3',
  '1.9': 'v1.9-lia16.4',
  '1.10': 'v1.10-lia16.5',
  '2': 'v2-lia16.6',
  '2.0': 'v2-lia16.6'
};

const THEME_BASE_VERSION_PATH_MAP = {
  '1': 'v1-lia17.8',
  '1.0': 'v1-lia17.8',
  '1.1': 'v1.1-lia17.9'
};

const THEME_SUPPORT_VERSION_PATH_MAP = {
  '1': 'v1-lia17.8',
  '1.0': 'v1-lia17.8',
  '1.1': 'v1.1-lia17.9'
};

const THEME_MARKETING_VERSION_PATH_MAP = {
  '1': 'v1-lia17.9',
  '1.0': 'v1-lia17.9'
};

const _options = {
  customerId: null, // the customer id
  communityId: null, // the community id
  pluginId: null, // the plugin id
  phase: 'stage', // the plugin phase to use
  pluginPath: '../plugins/custom', // relative or absolute path to where all your plugins are checked out
  skin: 'responsive_peak', // skin id that will be compiled and served
  compiledSkinName: 'responsive_peak.css', // name of the compiled skin file
  liaRelease: '16.10', // the lia release the customer is on
  responsiveVersion: '2.0', // the version of responsive being used
  tmpPathBase: './.tmp', // relative or absolute path where temporary files will be stored, like the compiled CSS
  sass: { // SASS config options
    precision: 10 // SASS precision
  },
  host: { // config value for: host
    sshIdentityFile: '~/.ssh/id_rsa' + (user !== undefined ? '-' + user : ''), // ssh identity file to host
    sshUsername: null // ssh username to host
  },
  hostname: null, // config value for: hostname
  tapestryContext: 't5', // config value for: tapestry.context.name
  restapiContext: null, // config value for: appserver.restapi.contexts
  https: true, // use https for app server requests
  httpPort: 80, // http port for app server requests
  httpsPort: 443, // https port for app server requests
  localServer: { // local server options used for serving compiled CSS along with images and fonts.
    httpPort: 9000, // local server http port
    httpsPort: 9001 // local server https port
  },
  liveReload: true, // whether to use local livereload server
  autoCommit: true, // whether the plugin changes are automatically committed to SVN
  syncToRemote: true, // whether local plugin asset changes are sync'd to the plugin on the remote VM
  convertLocalSyncPath: [], // hack file path converter for windows
  checkFileChanged: false, // Use in-mem content check to see if file contents have changed when triggered by watcher
  theme: false, //whether to use community theme
  themeVersion: null, //config value for: themeVersion (theme version/name which we need to use)
  themeBaseVersion: null, //config value for: themeBaseVersion (theme version/name which we need to use)
  themeSupportVersion: null, //config value for: themeSupportVersion (theme version/name which we need to use)
  themeMarketingVersion: null //config value for: themeMarketingVersion (theme version/name which we need to use)
};

let options;

function initOptions() {
  if (options === undefined) {
    options = extend(true, {}, _options, optionsFromConfig(overrides.config || 'default'), overrides);
    if (_options.versionPath === undefined) {
      options.versionPath = RESPONSIVE_VERSION_PATH_MAP[options.responsiveVersion];
    }
    if (_options.themeBasePath === undefined) {
      if (options.themeBaseVersion !== null) {
        options.themeBasePath = THEME_BASE_VERSION_PATH_MAP[options.themeBaseVersion];
      } else {
        options.themeBasePath = '';
      }
    }
    if (_options.themeSupportPath === undefined) {
      if (options.themeSupportVersion !== null) {
        options.themeSupportPath = THEME_SUPPORT_VERSION_PATH_MAP[options.themeSupportVersion];
      } else {
        options.themeSupportPath = '';
      }
    }
    if (_options.themeMarketingPath === undefined) {
      if (options.themeMarketingVersion !== null) {
        options.themeMarketingPath = THEME_MARKETING_VERSION_PATH_MAP[options.themeMarketingVersion];
      } else {
        options.themeMarketingPath = '';
      }
    }

    logger.debug('Derived config options: \n' + JSON.stringify(options, null, 2));
  }

  return options;
}

function configJson() {
  try {
    return require('../config.json');
  } catch (err) {
    logger.error('Error reading config.json:', err.message);
    process.exit(0);
  }
}

function configExists(configName) {
  const configFile = configJson();
  return configFile.configs && configFile.configs[configName];
}

function optionsFromConfig(configName) {
  let defaults = {};
  let config = {};
  let finalConfig = {};

  const configFile = configJson();

  if (configFile.configs) {
    defaults = configFile.configs.default;
    config = configFile.configs[configName];
  }

  finalConfig = extend(true, {}, finalConfig, defaults, config);

  let hostObj = {};
  if (configFile.hosts !== undefined) {
    const originalHostVal = finalConfig.host;

    if (typeof originalHostVal === 'string') {
      hostObj = configFile.hosts[originalHostVal] || {};
      hostObj.host = hostObj.host || originalHostVal;
    } else {
      hostObj = originalHostVal;
    }
  }

  finalConfig.host = extend({}, configFile.hosts.default, hostObj);

  return finalConfig;
}

function requestRemoteConfig(configName) {
  return new Promise((fufill, reject) => {
    logger.info('Attempting to retrieve config data for ' + chalk.cyan(configName) + ' from ' +
      chalk.cyan(`https://repo.sj.lithium.com/config/all?name=${configName}`));
    request.get('https://repo.sj.lithium.com/config/all', {
      qs: {
        name: configName
      },
      json: true
    }, (error, response, body) => {
      if (error) {
        reject(error);
      }
      if (response.statusCode !== 200) {
        logger.warn('No defaults found for:', configName);
        fufill({});
        return;
      }
      const communityId = configName.split('.')[0];
      const pathParts = body['plugins.appRootDir'].split('/');
      const customPathIdx = pathParts.indexOf('custom');
      const customerId = (customPathIdx >= 0 && pathParts.length > customPathIdx + 1) ? pathParts[customPathIdx + 1] : undefined;
      const pluginId = (customPathIdx >= 0 && pathParts.length > customPathIdx + 2) ? pathParts[customPathIdx + 2] : undefined;
      var theme = false;
      var themeVersion = '';
      const pluginsPart = body['plugins'].split(' ');
      for(var i=0; i<pluginsPart.length; i++) {
        if(pluginsPart[i].indexOf('communitythemes') > 1) {
          theme = true;
          themeVersion+= pluginsPart[i] + ",";
        }
      }
      if(theme){
        themeVersion = themeVersion.replace(/,\s*$/, "");
        logger.info('Community theme paths available: ' + chalk.cyan(themeVersion));
      }
      let data = {
        customerId: customerId,
        communityId: communityId,
        pluginId: pluginId,
        host: body.host,
        hostname: body.hostname,
        tapestryContext: body['tapestry.context.name'],
        restapiContext: body['appserver.restapi.contexts'].replace(/^\/|\/$/g, ''),
        phase: body.phase,
        liaRelease: body['app.version.major'] + '.' + body['app.version.minor'],
        https: body['apache.ssl'] === 'true',
        httpPort: Number(body['webserver.proxyPort']),
        httpsPort: 443,
        theme: theme,
        themeVersion: themeVersion
      };

      logger.info('Success! Retrieved data for:', configName, true);
      logger.debug('Config data retrieved:',  JSON.stringify(data, null, 2));

      fufill(data);
    });
  }).catch(errorHandler)
}

function requiredField(val) {
  return val.length === 0 ? 'Please provide a value' : true;
}

function inquireAddConfig(configName, inquireAll) {
  let configFromServer;
  let pluginSkinsPromise;
  let pluginThemsPromise;

  function readPluginSkins(customerSkinPath) {
    if (!pluginSkinsPromise) {
      pluginSkinsPromise = fs.readdir(customerSkinPath).then(files => {
        return files.filter(file => file.indexOf('.') !== 0);
      });
    }
    return pluginSkinsPromise;
  }

  function readPluginThemes(customerThemePath) {
    if (!pluginThemsPromise) {
      pluginThemsPromise = fs.readdir(customerThemePath).then(files => {
        return files.filter(file => file.indexOf('.') !== 0);
      });
    }
    return pluginThemsPromise;
  }

  return inquirer.prompt([
    {
      type: 'input',
      name: 'configName',
      message: 'Config name (<communityId>.<phase>)?',
      validate: requiredField,
      'default': configName
    },
    {
      type: 'input',
      name: 'customerId',
      message: 'Customer Id (used in plugin folder path: /custom/<customerId>/<pluginId>/<phase>)?',
      validate: requiredField,
      when: answers => {
        configFromServer = configFromServer ? configFromServer : requestRemoteConfig(answers.configName);
        return configFromServer
          .then(data => extend(answers, data))
          .then(data => inquireAll === true || !data.customerId);
      },
      'default': answers => configFromServer.then(data => data.customerId)
    },
    {
      type: 'input',
      name: 'communityId',
      message: 'Community Id (used in config-name: <communityId>.<phase>)?',
      validate: requiredField,
      when: answers => configFromServer.then(data => inquireAll === true || (!data.communityId && !answers.configName.split('.')[0])),
      'default': answers => configFromServer.then(data => data.communityId || answers.configName.split('.')[0])
    },
    {
      type: 'input',
      name: 'pluginId',
      message: 'Plugin Id (used in plugin folder path: /custom/<customerId>/<pluginId>/<phase>)?',
      validate: requiredField,
      when: () => configFromServer.then(data => inquireAll === true || !data.pluginId),
      'default': () => configFromServer.then((data) => data.pluginId)
    },
    {
      type: 'input',
      name: 'host',
      message: '"host" config value?',
      when: () => configFromServer.then(data => inquireAll === true || !data.host),
      'default': () => configFromServer.then((data) => data.host)
    },
    {
      type: 'input',
      name: 'hostname',
      message: '"hostname" config value?',
      when: () => configFromServer.then(data => inquireAll === true || !data.hostname),
      'default': () => configFromServer.then((data) => data.hostname)
    },
    {
      type: 'input',
      name: 'tapestryContext',
      message: '"tapestry.context.name" config value?',
      when: () => configFromServer.then(data => inquireAll === true || !data.tapestryContext),
      'default': () => configFromServer.then((data) => data.tapestryContext || 't5')
    },
    {
      type: 'input',
      name: 'restapiContext',
      message: '"appserver.restapi.contexts" config value?',
      when: () => configFromServer.then(data => inquireAll === true || !data.restapiContext),
      'default': () => configFromServer.then((data) => data.restapiContext)
    },
    {
      type: 'input',
      name: 'phase',
      message: '"phase" config value?',
      when: answers => configFromServer.then(data => inquireAll === true || (!data.phase && !answers.configName.split('.').length > 0)),
      'default': answers => configFromServer.then(data => data.phase || !answers.configName.split('.')[1] || 'stage')
    },
    {
      type: 'confirm',
      name: 'https',
      message: 'Use HTTPS?',
      when: () => configFromServer.then(data => inquireAll === true || !data.https),
      'default': () => configFromServer.then(data => data.https || true)
    },
    {
      type: 'input',
      name: 'httpPort',
      message: 'HTTP port?',
      when: answers => configFromServer.then(data => inquireAll === true || (!answers.https && !data.httpPort)),
      'default': () => configFromServer.then(data => data.httpPort || 80)
    },
    {
      type: 'input',
      name: 'httpsPort',
      message: 'HTTPS port?',
      when: answers => configFromServer.then(data => inquireAll === true || (answers.https && !data.httpsPort)),
      'default': () => configFromServer.then(data => data.httpsPort || 443)
    },
    {
      type: 'list',
      name: 'liaRelease',
      message: 'Lia Release?',
      choices: ['16.6', '16.7', '16.8', '16.9', '16.10', '16.11', '16.12', 'active'],
      when: () => configFromServer.then(data => inquireAll === true || !data.liaRelease),
      'default': () => configFromServer.then(data => data.liaRelease)
    },
    {
      type: 'input',
      name: 'responsiveVersion',
      message: 'Responsive Skin feature version?',
      when: answers => {
        const options = extend(true, {}, _options, optionsFromConfig('default'), answers);
        const paths = require('./paths')(options);
        logger.info('Attempting to determine Responsive Peak version from:', paths.featureVersionsUrl);
        return new Promise((resolve) => {
          request({
            url: paths.featureVersionsUrl,
            json: true,
            port: options.https ? options.httpsPort : options.httpPort
          }, (error, res) => {
            if (error || res.statusCode !== 200 && res.body && Array.isArray(res.body.features)) {
              logger.debug('Failed to automatically detect responsive feature version:', error);
              resolve(true);
            } else {
              const responsiveFeautre = res.body.features.filter(feature => feature.id === 'responsivepeak')[0];
              if (responsiveFeautre && responsiveFeautre.version) {
                answers.responsiveVersion = responsiveFeautre.version.indexOf('.') > -1 ? responsiveFeautre.version : responsiveFeautre.version + '.0';
                logger.info('Determined Responsive Skin version from app:', answers.responsiveVersion);
                resolve(false);
              } else {
                logger.debug('Failed to automatically detect responsive feature version, malformed response:', res.body.features);
                resolve(true);
              }
            }
          });
        });
      },
      'default': '2.0'
    },
    {
      type: 'list',
      name: 'skin',
      message: 'Skin name?',
      when: answers => {
        const options = extend(true, {}, _options, optionsFromConfig('default'), answers);
        const paths = require('./paths')(options);
        logger.info('Loading possible skins from:', paths.customerSkinPath);
        return fs.access(paths.customerSkinPath)
          .then(() => readPluginSkins(paths.customerSkinPath))
          .then(files => {
            if (files.length === 1) {
              answers.skin = files[0];
              logger.info('Only one skin available, auto-selecting skin:', answers.skin);
              return false;
            } else if (files.length === 0) {
              logger.warn('No skins were found in customer plugin at:', paths.customerSkinPath);
            }
            return true;
          })
          .catch(() => {
            logger.warn('Unable to access path at when looking for skins to select:', paths.customerSkinPath);
            return false;
          });
      },
      choices: answers => {
        const options = extend(true, {}, _options, optionsFromConfig('default'), answers);
        const paths = require('./paths')(options);
        return readPluginSkins(paths.customerSkinPath);
      }
    },
    {
      type: 'input',
      name: 'skin',
      message: 'Skin name?',
      when: answers => !answers.skin
    }
  ]).then(addConfig);
}

function addConfig(data) {
  const configFile = configJson();
  const configName = data.configName;
  const alreadyExisted = configName in configFile.configs;
  delete data.configName;
  configFile.configs[configName] = data;
  logger.debug('Config value to be ' + (alreadyExisted ? 'updated' : 'added') + ':');
  logger.debug(JSON.stringify(data, null, 2));

  return fs.writeFile('./config.json', JSON.stringify(configFile, null, 2)).then(() =>
      logger.info('Config ' + (alreadyExisted ? 'updated in' : 'added to') + ' config.json. Use it with:', 'gulp --config=' + configName));
}

function inquireInitConfig() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'pluginPath',
      message: 'Relative or absolute path to where your plugins are checked out',
      validate: requiredField,
      'default': '../lia/plugins/custom'
    },
    {
      type: 'input',
      name: 'sshIdentityFile',
      //when: answers => answers.type === 'Identity File',
      message: 'Relative or absolute path to your SSH Identity File',
      validate: requiredField,
      'default': '~/.ssh/id_rsa' + (user !== undefined ? '-' + user : '')
    }
  ]).then(initConfig);
}

function initConfig(data) {
  var configJson = {
    configs: {
      'default': {
        pluginPath: data.pluginPath,
        compiledSkinName: 'responsive_peak.css',
        tmpPathBase: './.tmp',
        sass: {
          precision: 10
        },
        localServer: {
          httpPort: 9000,
          httpsPort: 9001
        },
        liveReload: true,
        autoCommit: true,
        syncToRemote: true,
        convertLocalSyncPath: [],
        checkFileChanged: false
      }
    },
    hosts: {
      'default': {
        sshIdentityFile: data.sshIdentityFile
      }
    }
  };

  fs.access(data.pluginPath).catch(() => {
    logger.warn('Unable to access path, are you sure that is correct:', paths.customerSkinPath);
  });
  return fs.writeFile('./config.json', JSON.stringify(configJson, null, 2))
    .then(() =>
      logger.info('Success, config file created! Now create a config with:', 'gulp add-config', true));
}

function inquireAddHost() {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'Host where app instance is served from?',
      validate: requiredField,
      'default': initOptions().host || 'sjc1qapp02.sj.lithium.com'
    },
    {
      type: 'list',
      name: 'type',
      message: 'Connection type (Identity File is preferred)?',
      choices: ['Identity File', 'Username'],
      'default': 'Identity File'
    },
    {
      type: 'input',
      name: 'sshIdentityFile',
      when: answers => answers.type === 'Identity File',
      message: 'Relative or absolute path to Identity File',
      validate: requiredField,
      'default': '~/.ssh/id_rsa'
    },
    {
      type: 'input',
      name: 'sshUsername',
      when: answers => answers.type === 'Username',
      message: 'SSH username to host?',
      validate: requiredField,
      'default': 'lithium'
    }
  ]).then(addHost);
}

function addHost(data) {
  const configFile = configJson();
  delete data.type;
  configFile.hosts[data.host] = data;

  return fs.writeFile('./config.json', JSON.stringify(configFile, null, 2))
    .then(() => logger.info('Host added to config.json.'));
}

module.exports = (_overrides, _logger) => {
  overrides = _overrides;
  logger = _logger;
  errorHandler = error(logger).errorHandler;

  return {
    options: initOptions,
    configExists,
    requestRemoteConfig,
    inquireAddConfig,
    inquireInitConfig,
    inquireAddHost
  };
};
