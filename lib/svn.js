'use strict';

const spawn = require('child_process').spawn;
const error = require('./error');
const slash = require('slash');
const fs = require('fs-promise');

let logger;
let overrides;
let errorHandler;

let commitLock = false;
let commitQueue = [];
let fileCache = {};
let fileChangedCleanerInterval = null;

function cmd(args, preventLog) {
  logger.debug('Run SVN with arguments:', args.join(' '));

  return new Promise((resolve, reject) => {
    const svn = spawn('svn', args);
    let error = '';

    if (preventLog !== true) {
      svn.stdout.on('data', (data) => {

        const msg = data.toString().trim();
        msg.split(/[\n,\r]/).forEach(part => {
          part = part.replace('        ', ' ');
          logger.info('SVN:', part);
        });
      });
    }

    svn.stderr.on('data', (data) => {
      error += data;
    });

    svn.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(error.trim()));
      }
    });
  });
}

function inVcs(filePath) {
  return cmd(['info', filePath], true);
}

function handleCommitLockAndQueue() {
  commitLock = false;
  if (commitQueue.length > 0) {
    const filePath = commitQueue.shift();
    logger.info('De-queueing for SVN sync:', filePath);
    return commit(filePath);
  }
  return Promise.resolve();
}

function commit(filePath) {
  // Append a @ to the end when one exists in the path
  // http://stackoverflow.com/questions/757435/how-to-escape-characters-in-subversion-managed-file-names
  filePath = filePath.indexOf('@') > -1 ? filePath + '@' : filePath;

  if (commitLock) {
    logger.info('Queueing for SVN sync.', filePath);
    commitQueue.push(filePath);
  } else {
    commitLock = true;
    const normalizedFilePath = slash(filePath);
    const pathParts = normalizedFilePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    if (overrides.jira) {
      var JIRA = overrides.jira + ": ";
    } else {
      var JIRA = '';
    }
    const commitMessage = JIRA + `Changed the ${fileName} from the plugin.`;
    logger.info('Attempt to commit to SVN:', fileName);
    return inVcs(filePath)
      .then(() => cmd(['ci', filePath, '-m', commitMessage])
        .then(() => logger.info('Success! Committed file with commit message:', commitMessage, true))
        .catch((err) => errorHandler(err, true)))
      .then(handleCommitLockAndQueue)
      .catch((err) => {
        logger.error('Unable to commit:', filePath);
        errorHandler(err, true);
        return handleCommitLockAndQueue();
      });
  }
}

function fileChanged(filePath) {
  logger.debug('Checking if contents have changed for:', filePath);

  return fs.readFile(filePath).then(contents => {
    let changed = true;
    let existsInCache = filePath in fileCache;
    if (existsInCache) {
      changed = fileCache[filePath] !== contents.toString();

      logger.debug('Cached file hit, comparing contents to see if changed');
      logger.debug('File contents before:\n', fileCache[filePath]);
      logger.debug('File contents after:\n', contents);
    }

    logger.debug('Contents ' + (changed ? 'did' : 'did not') + ' change:', filePath);

    fileCache[filePath] = contents.toString();

    if (fileChangedCleanerInterval === null) {
      fileChangedCleanerInterval = setInterval(() => {
        if (!commitLock) {
          logger.debug('Clearing in-mem file-change content cache.');
          fileCache = {};
          clearInterval(fileChangedCleanerInterval);
          fileChangedCleanerInterval = null;
        }
      }, 600000);
    }

    return changed;
  });


}

module.exports = (_logger, _overrides) => {
  logger = _logger;
  overrides = _overrides;
  errorHandler = error(logger).errorHandler;

  return {
    cmd,
    inVcs,
    commit,
    fileChanged
  };
};