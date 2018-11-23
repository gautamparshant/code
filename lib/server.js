'use strict';

const connect = require('connect');
const serveStatic = require('serve-static');
const http = require('http');
const https = require('https');
const pem = require('pem');
const fs = require('fs-promise');
const promisify = require("es6-promisify");
const exec = require('child_process').exec;
const chalk = require('chalk');

let logger;
let options;
let paths;
let errorHandler;

function createCert() {
  logger.info('Creating cert for local https server.');

  return fs.ensureDir(paths.tmpCertDirPath)
    .then(() => promisify(pem.createCertificate, pem)({ selfSigned: true }))
    .then((keys) => {
      return Promise.all([
        fs.writeFile(paths.tmpCertPath, keys.certificate),
        fs.writeFile(paths.tmpCertKeyPath, keys.serviceKey)
      ])
    });
}

function certExists() {
  return Promise.all([
    fs.access(paths.tmpCertPath).then(() => true).catch(() => false),
    fs.access(paths.tmpCertKeyPath).then(() => true).catch(() => false)
  ]).then(values => values[0] && values[1]).catch(() => false);
}

function trustCert() {
  logger.info('Enter your system password if prompted. This is used to trust the local cert needed for https.');
  return new Promise((resolve, reject) => {
    exec(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ${paths.tmpCertPath}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Error trusting cert: ${error}`));
          return;
        }
        if (stdout) {
          logger.debug(`${stdout}`);
        }
        if (stderr) {
          logger.debug(`${stderr}`);
        }
        resolve();
      });
  });
}

function start() {
  const app = connect();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
  });

  if (options.https) {
    app.use((req, res, next) => {
      if (!req.connection.encrypted) {
        res.writeHead(302, { // prevent caching redirect in case changed from https often
          'Location': `${paths.localServerBaseUrl}${req.url}`
        });
        res.end();
      } else {
        next();
      }
    });
  }

  app.use(serveStatic(paths.tmpCompilePath));
  app.use(serveStatic(paths.tmpPluginWebPath));
  app.use(serveStatic(paths.customerWebPath));

  return certExists()
    .then(exists => exists ? Promise.resolve() : createCert().then(trustCert))
    .then(() => {
      return new Promise((resolve) => {
        // Always create the http server to redirect to https when needed
        http.createServer(app).listen(options.localServer.httpPort, () => {
          if (!options.https) {
            logger.info('Local server started, serving CSS at:', paths.localServerSkinUrl);
            resolve();
          }
        });

        if (options.https) {
          https.createServer({
            key: fs.readFileSync(paths.tmpCertKeyPath),
            cert: fs.readFileSync(paths.tmpCertPath)
          }, app).listen(options.localServer.httpsPort, () => {
            logger.info('Local server started, serving CSS at:', paths.localServerSkinUrl);
            resolve();
          });
        }
      });
    });
}

module.exports = (_logger, _options, _paths) => {
  logger = _logger;
  options = _options;
  paths = _paths;

  return {
    start
  }
};
