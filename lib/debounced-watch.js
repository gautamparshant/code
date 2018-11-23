'use strict';

const watch = require('gulp-watch');
const debounce = require('lodash.debounce');

module.exports = function (glob, opts, cb) {
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }

  const debounceWait = opts.debounceOptions || 250;
  const debounceOptions = opts.debounceOptions || {};

  cb = cb || function () {};
  return watch(glob, opts, debounce(cb, debounceWait, debounceOptions));
};