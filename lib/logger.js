'use strict';

const chalk = require('chalk');
const hasGulplog = require('has-gulplog');

const LOG_LEVELS = {
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4
};

/**
 * Poor mans logger that delegates to logger and colors accordingly.
 *
 * @param logger instance used for logging to stdout
 * @param debugLevel the level of logger to use
 * @returns {{debug: Function, info: Function, warn: Function, error: Function, level: *}}
 */
module.exports = (logger, debugLevel = LOG_LEVELS.DEBUG) => {
  const level = (typeof debugLevel === 'string' && LOG_LEVELS.hasOwnProperty(debugLevel.toUpperCase())) ? LOG_LEVELS[debugLevel.toUpperCase()] : debugLevel;

  function doLog(logLevel, msg1, color1, msg2, color2) {
    let finalMsg = '';
    if (logLevel >= level) {
      finalMsg += chalk[color1](msg1);
      if (msg2) {
        finalMsg += ' ' + chalk[color2](msg2);
      }
    }
    if (finalMsg.length > 0) {
      logger(finalMsg);
    }
  }

  return {
    debug: (msg1, msg2) => doLog(LOG_LEVELS.DEBUG, msg1, 'grey', msg2, 'grey'),
    info: (msg1, msg2, success) => doLog(LOG_LEVELS.INFO, msg1, success ? 'green' : 'magenta', msg2, 'cyan'),
    warn: (msg1, msg2) => doLog(LOG_LEVELS.WARN, msg1, 'yellow', msg2, 'cyan'),
    error: (msg1, msg2) => doLog(LOG_LEVELS.ERROR, msg1, 'red', msg2, 'cyan'),
    level: level
  }
};