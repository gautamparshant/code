'use strict';

const gulp = require('gulp');
const gutil = require('gulp-util');
const chalk = require('chalk');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const rename = require('gulp-rename');
const plumber = require('gulp-plumber');
const filelog = require('gulp-filelog');
const livereload = require('gulp-livereload');
const del = require('del');
const fs = require('fs-promise');
const runSequence = require('run-sequence');
const debouncedWatch = require('./lib/debounced-watch');
const argv = require('minimist')(process.argv.slice(2));
const VERSION = '1.0.0';

// Normalize boolean arguments
['https', 'liveReload', 'autoCommit', 'syncToRemote'].forEach(item => {
  if (item in argv) {
    argv[item] = argv[item] === 'true' ? true : false;
  }
});

// Command line arguments:
//  --config - name of the config to use
//  --loggingLevel - level of message logging, default to 2; available levels: DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4
//  --inquireAll - Force all questions to be asked when add-config is run.
//  --local - If the app instance is running locally, optionally the address of the local instance
//  --showFilesWatched - Outputs all of the files being watched
const configOverrides = argv;
const configName = argv.config;
const logLevel = argv.loggingLevel || 2;
const useInquireAll = argv.inquireAll;
const showFilesWatched = argv.showFilesWatched;

const logger = require('./lib/logger')(gutil.log, logLevel);
const config = require('./lib/config')(configOverrides, logger);
const _paths = options => require('./lib/paths')(options);
const _sync = (options, paths) => require('./lib/sync')(logger, options, paths);
const _plugin = (options, paths) => require('./lib/plugin')(logger, options, paths);
const _server = (options, paths) => require('./lib/server')(logger, options, paths);
const svn = require('./lib/svn')(logger, configOverrides);
const errorHandler = require('./lib/error')(logger).errorHandler;


logger.info('Starting services-sdk tool version:', VERSION);

/**
 * Validates that a config has been specified and that it exists in the config.json
 * Exits the gulp process if invalid.
 */
function validateConfigSpecified() {
  if (!configName) {
    logger.error('You must specify a --config flag');
    process.exit(0);
  } else if (!config.configExists(configName)) {
    logger.error(`The config [${configName}] does not exist in your config file.`);
    process.exit(0);
  }
}

/**
 * Performs the SASS compilation.
 * @returns {*}
 */
function sassTask() {
  validateConfigSpecified();

  const options = config.options();
  const paths = _paths(options);

  options.sass.includePaths = [paths.customerSkinPath].concat(paths.coreSassPaths(false)).concat(paths.themeSassPaths(false));

  logger.debug('SASS include paths:');
  options.sass.includePaths.forEach(path => logger.debug('\t' + path));

  if (logger.level === 1) {
    fs.accessSync(paths.customerSkinFilePath, (err) => errorHandler(err, true));
  }

  logger.debug('Write compiled CSS to ' + paths.tmpCompileStylesPath + '/' + options.compiledSkinName);

  return gulp.src(paths.customerSkinFilePath)
    .pipe(plumber())
    .pipe(sourcemaps.init())
    .pipe(sass(options.sass).on('error', sass.logError))
    .pipe(sourcemaps.write())
    .pipe(rename(options.compiledSkinName))
    .pipe(gulp.dest(paths.tmpCompileStylesPath))
    .pipe(options.liveReload ? livereload() : gutil.noop());
}

/**
 * Default task, triggers the server, sync-remote, sync-theme, and watch tasks
 */
gulp.task('default', cb => runSequence('serve', 'watch', () => logger.info(chalk.green('Ready to go!'))));

/**
 * Serve task, triggers the sass task. Used for servering the compiled SASS from a tmp directory.
 */
gulp.task('serve', ['sass'], () => {
  validateConfigSpecified();

  const options = config.options();
  const paths = _paths(options);
  const server = _server(options, paths);
  return server.start().catch(errorHandler);
});

/**
 * SASS task, triggers sync
 */
gulp.task('sass', ['sync-remote'], sassTask);

/**
 * SASS task, no remote sync triggered (used by watch task)
 */
gulp.task('sass-no-remote-sync', sassTask);

/**
 * Watch task
 */
gulp.task('watch', () => {
  validateConfigSpecified();

  const options = config.options();
  const paths = _paths(options);
  const sync = _sync(options, paths);
  const plugin = _plugin(options, paths);
  const watchPaths = [paths.customerSassFilePath, paths.customerPluginWatchPath];

  if (options.liveReload) {
    livereload.listen({
      quiet: true
    });
  }

  if (showFilesWatched) {
    fs.ensureDir(paths.tmpCountPath).then(() => {
      gulp.src(watchPaths.concat(paths.customerPluginWatchIgnorePath), {read: false})
        .pipe(filelog())
        .pipe(gulp.dest(paths.tmpCountPath))
        .on('end', () => del(paths.tmpCountPath, { force: true }));
    });
  }

  logger.debug('Watching file paths:')
  watchPaths.forEach(path => logger.debug('\t' + path));
  logger.debug('Ignore file watch paths:');
  logger.debug('\t' + paths.customerPluginWatchIgnorePath);

  debouncedWatch(paths.customerSassFilePath, event => {
    let checkFileChanged = options.checkFileChanged ? svn.fileChanged(event.path) : Promise.resolve(true);

    return checkFileChanged.then(changed => {
      if (changed) {
        if (options.autoCommit) {
          svn.commit(event.path);
        }
        return runSequence('sass-no-remote-sync');
      }
    });
  });

  debouncedWatch([paths.customerPluginWatchPath, paths.customerPluginWatchIgnorePath], event => {
    let checkFileChanged = options.checkFileChanged ? svn.fileChanged(event.path) : Promise.resolve(true);

    return checkFileChanged.then(changed => {
      if (changed) {
        if (options.autoCommit) {
          svn.commit(event.path);
        }
        const syncPromise = options.syncToRemote ? sync.syncLocalFileToRemote(event.path) : Promise.resolve(event.path);

        return syncPromise
          .then(plugin.refreshPlugin)
          .then(() => {
            if (options.liveReload) {
              livereload.changed(event);
              logger.info('Livereload triggered.');
            }
          })
          .catch(err => errorHandler(err, true));
      }
    });

  });
});

/**
 * Sync angular core task
 */
gulp.task('sync-remote', ['sync-theme'], () => {
  validateConfigSpecified();

  const options = config.options();
  const paths = _paths(options);
  const sync = _sync(options, paths);

  return sync.syncRemoteCoreSassToLocal(false).catch(errorHandler);
});

/**
 * Sync theme core task
 */
gulp.task('sync-theme', () => {
  validateConfigSpecified();

  const options = config.options();
  const paths = _paths(options);
  const sync = _sync(options, paths);

  if (options.themeBaseVersion !== null || options.themeSupportVersion !== null || options.themeMarketingVersion !== null) {
    return sync.syncRemoteCoreSassToLocal(true).catch(errorHandler);
  } else {
    return true;
  }
});

/**
 * Init config task
 */
gulp.task('init-config', () => {
  try {
    require('./config.json');
    logger.warn('config.json already exists, consider using ' + chalk.green('gulp add-config') +
      ' to add another config');
    process.exit(0);
  } catch (err) {
    return config.inquireInitConfig().catch(errorHandler);
  }
});

/**
 * Add config task
 */
gulp.task('add-config', () => {
  return config.inquireAddConfig(configName, useInquireAll).catch(errorHandler);
});

/**
 * Add host task
 */
gulp.task('add-host', () => {
  return config.inquireAddHost().catch(errorHandler);
});

/**
 * Clean tmp folder task
 */
gulp.task('clean', () => {
  return del('.tmp', { force: true });
});