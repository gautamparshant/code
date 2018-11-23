'use strict';

const Rsync = require('rsync');
const fs = require('fs-promise');
const chalk = require('chalk');
const untildify = require('untildify');
const slash = require('slash');
const path = require('path');

let logger;
let options;
let paths;

function syncRemoteCoreSassToLocal(syncTheme) {
  if (syncTheme === undefined) {
    const syncTheme = false;
  }
  return fs.ensureDir(paths.tmpPluginPath).then(() => {
    const patterns = [];
    let fileCount = 0;
    var logtype = 'core';
    var logtypecap = 'Core';
    var corePath = paths.serverCoreAngularLiPath;
    if (syncTheme) {
      logtype = 'theme';
      logtypecap = 'Theme';
      corePath = paths.serverCoreThemePath
    }

    function progressBarOutput(data, stream) {
      const msg = data.toString().trim();

      msg.split('\r').forEach(part => {
        const parts = part.split(path.sep);
        if (parts.length > 1) {
          const lastPart = parts.length > 0 ? parts[parts.length - 1] : '';
          const file = lastPart.split(' ')[0];
          if (file && file.length > 0 && file.indexOf('.') !== -1) {
            fileCount++;

            logger.debug('Syncing:', part);
            let dots = new Array(Math.ceil(fileCount / 10)).fill('.').join('');
            if ((fileCount % 6) == 0) {
              process.stdout.write('.');
            }
          }
        }
      });
    }

    if (syncTheme) {
      paths.themeSassPaths(true).forEach(item => {
        patterns.push({action: '+', pattern: item + '/***'});
      });
    } else {
      paths.coreSassPaths(true).forEach(item => {
        patterns.push({action: '+', pattern: item + '/***'});
      });
    }

    patterns.push({action: '+', pattern: 'web/***'});
    patterns.push({action: '+', pattern: '*/'});
    patterns.push({action: '-', pattern: '*'});

    logger.info('Syncing ' + logtype + ' skin(s) from remote app to local.');

    const rsync = new Rsync()
      .flags('azm')
      .set('progress')
      .set('rsync-path', options.host.rsyncPath ? options.host.rsyncPath : 'sudo -u lithium rsync')
      .set('e', 'ssh' + (options.host.sshIdentityFile ? ' -i ' + untildify(options.host.sshIdentityFile) : ''))
      .source(corePath)
      .destination(paths.tmpPluginNoReleasePath)
      .patterns(patterns)
      .output(data => progressBarOutput(data, rsync), err => logger.info(err));

    logger.debug('Rsync command:', rsync.command());

    return new Promise((fufill, reject) => {
      rsync.execute(err => {
        if (err) {
          logger.error('Error syncing ' + logtype + ' skin(s):', err);
          reject(err);
        } else {
          if (fileCount > 0) {
            process.stdout.write('\n');
            logger.info('Success! ' + logtypecap + ' skin(s) sync from remote to local complete.', null, true);
            fufill();
          } else {
            logger.info(logtypecap + ' skin(s) already n\'sync.');
            fufill();
          }
        }
      });
    });
  });
}

function syncLocalFileToRemote(fullFilePath) {
  const normalizedFilePath = slash(fullFilePath);

  const pluginPathParts = normalizedFilePath.split(paths.pluginPath);
  if (pluginPathParts.length <= 1) {
    return Promise.reject(new Error(`File path to sync is invalid. Unable to fine ${paths.pluginPath} in ${normalizedFilePath}`));
  }
  const filePath = pluginPathParts[1];
  const filePathParts = filePath.split('/');
  if (filePathParts.length <= 1) {
    return Promise.reject(new Error(`File path to sync is invalid. File path parts: ${filePathParts}`));
  }
  const partialPath = filePathParts.slice(0, filePathParts.length - 1).join('/');

  let sourceFilePath = fullFilePath;
  if (Array.isArray(options.convertLocalSyncPath)) {
    options.convertLocalSyncPath.forEach(converter => {
      sourceFilePath = sourceFilePath.replace(new RegExp(converter.regExp, 'g'), converter.replaceWith);
    })
  }

  logger.info('Syncing local file ' + chalk.cyan(fullFilePath) + ' to remote:', paths.serverPluginsCustomPath + partialPath);

  const rsync = new Rsync()
    .flags('azm')
    .set('progress')
    .set('rsync-path', options.host.rsyncPath ? options.host.rsyncPath : 'sudo -u lithium rsync')
    .set('e', 'ssh' + (options.host.sshIdentityFile ? ' -i ' + untildify(options.host.sshIdentityFile) : ''))
    .source(sourceFilePath)
    .destination(paths.serverPluginsCustomPath + partialPath);

  logger.debug('Rsync command:', rsync.command());

  return new Promise((fufill, reject) => {
    rsync.execute(err => {
      if (err) {
        logger.error('Error syncing file [' + sourceFilePath + ']:', err);
        reject(err);
      } else {
        logger.info('Success! Remote file sync complete!', null, true);
        fufill(sourceFilePath);
      }
    });
  });
}

module.exports = (_logger, _options, _paths) => {
  logger = _logger;
  options = _options;
  paths = _paths;

  return {
    syncRemoteCoreSassToLocal,
    syncLocalFileToRemote
  };
};