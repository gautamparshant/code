'use strict';

let logger;

/**
 * Basic error handling for tasks that emit errors.
 *
 * @param err the Error object
 * @param preventExit whether the process should be prevents from exiting on error.
 */
function errorHandler(err, preventExit) {
  if (err) {
    logger.error(err.message);
    logger.debug(err.stack);
    if (!preventExit) {
      process.exit(0);
    }
  }
}

module.exports = (_logger) => {
  logger = _logger;

  return {
    errorHandler
  };
};