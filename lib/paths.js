'use strict';

const template = require('lodash.template');

const REMOTE_VERSION_PATH = '<% print(liaRelease === "active" ? "active" : liaRelease + "-release") %>';
const REMOTE_THEME_PATH = '<% print(liaRelease === "active" ? "active" : liaRelease + "-release") %>';

const TMP_CUSTOMER_PATH = '<%= tmpPathBase %>/plugins/<%= customerId %>/<%= communityId %>/<%= phase %>';
const TMP_PLUGIN_NO_RELEASE_PATH = TMP_CUSTOMER_PATH + '/plugin';
const TMP_PLUGIN_PATH = TMP_CUSTOMER_PATH + '/plugin/' + REMOTE_VERSION_PATH;
const TMP_THEME_PATH = TMP_CUSTOMER_PATH + '/plugin/' + REMOTE_THEME_PATH;
const TMP_COUNT_PATH = TMP_CUSTOMER_PATH + '/count';
const TMP_PLUGIN_WEB_PATH = TMP_PLUGIN_PATH + '/web';
const TMP_COMPILE_PATH = TMP_CUSTOMER_PATH + '/compiled';
const TMP_COMPILE_STYLES_PATH = TMP_COMPILE_PATH + '/styles';
const TMP_CERT_DIR_PATH = '<%= tmpPathBase %>/certs';
const TMP_CERT_PATH = TMP_CERT_DIR_PATH + '/local.crt';
const TMP_CERT_KEY_PATH = TMP_CERT_DIR_PATH + '/local.key';

const LOCAL_SERVER_BASE_URL = '<% print(https ? "https" : "http") %>' +
  '://localhost:<% print(https ? localServer.httpsPort : localServer.httpPort) %>';
const LOCAL_SERVER_SKIN_URL = LOCAL_SERVER_BASE_URL + '/styles/<%= compiledSkinName %>';

const PLUGIN_PATH = '<%= customerId %>/<%= pluginId %>/<%= phase %>';
const CUSTOMER_PLUGIN_PATH = '<%= pluginPath %>/' + PLUGIN_PATH;
const CUSTOMER_PLUGIN_WATCH_PATH = CUSTOMER_PLUGIN_PATH + '/{res,web}/**/!(*.scss).*';
const CUSTOMER_PLUGIN_WATCH_IGNORE_PATH =  '!' + CUSTOMER_PLUGIN_PATH + '/res/compiledskin/**';

const CUSTOMER_SKIN_PATH = CUSTOMER_PLUGIN_PATH + '/res/skins';
const CUSTOMER_SKIN_FILE_PATH = CUSTOMER_PLUGIN_PATH + '/res/skins/<%= skin %>/sass/skin.scss';
const CUSTOMER_SASS_FILE_PATH = CUSTOMER_PLUGIN_PATH + '/res/skins/<%= skin %>/sass/**/**.scss';
const CUSTOMER_RES_PATH = CUSTOMER_PLUGIN_PATH + '/res';
const CUSTOMER_WEB_PATH = CUSTOMER_PLUGIN_PATH + '/web';

const VERSIONED_BASE_SKIN_PATH = '/res/feature/responsivebase/<%= versionPath %>/res/skins';
const VERSIONED_PEAK_SKIN_PATH = '/res/feature/responsivepeak/<%= versionPath %>/res/skins';
const COMMON_BASE_SKIN_PATH = '/res/feature/responsivebase/common/res/skins';
const COMMON_PEAK_SKIN_PATH = '/res/feature/responsivepeak/common/res/skins';

const THEME_PATH = '<%= pluginPath %>/communitythemes/';
const THEME_BASE_SKIN_PATH = '/res/feature/theme-base/<%= themeBasePath %>/res/skins';
const THEME_SUPPORT_SKIN_PATH = '/res/feature/theme-support/<%= themeSupportPath %>/res/skins';
const THEME_MARKETING_SKIN_PATH = '/res/feature/theme-marketing/<%= themeMarketingPath %>/res/skins';

const SERVER = '<% print(host && host.sshUsername ? host.sshUsername + "@" : "") %><%= host.host %>';
const SERVER_PLUGINS_PATH = SERVER + ':' + '/home/lithium/customer/<%= communityId %>.<%= phase %>/plugins';
const SERVER_PLUGINS_CUSTOM_PATH = SERVER_PLUGINS_PATH + '/custom/' + PLUGIN_PATH ;
const SERVER_CORE_ANGULAR_LI_PATH = SERVER_PLUGINS_PATH + '/core/lithium/angular-li/' + REMOTE_VERSION_PATH;
const SERVER_CORE_THEME_PATH = SERVER_PLUGINS_PATH + '/core/lithium/themes/' + REMOTE_THEME_PATH;

const TAPESTRY_BASE_PATH = '<% print(https ? "https" : "http") %>://<%= hostname %>' +
  '<% print(https ? (httpsPort === 443 ? "" : ":" + httpsPort) : (httpPort === 80 ? "" : ":" + httpPort)) %>' +
  '/<%= tapestryContext %>';

const PLUGIN_RELOAD_URL = TAPESTRY_BASE_PATH + '/api/plugin';
const FEATURE_VERSIONS_URL = TAPESTRY_BASE_PATH + '/status/featurespage:json';

module.exports = options => {

  function coreSassPaths(forRemote) {
    const imports = [];
    const isResponsiveV2 = options.responsiveVersion === 2.0 || options.responsiveVersion === 2;
    const prefix = (forRemote ? REMOTE_VERSION_PATH : TMP_PLUGIN_PATH);
    // Old theme in plugin/custom
    const isThemeUsed = options.theme;

    if (!isResponsiveV2) {
      imports.push(template(prefix + VERSIONED_BASE_SKIN_PATH)(options));
    }
    imports.push(template(prefix + VERSIONED_PEAK_SKIN_PATH)(options));
    if (!isResponsiveV2) {
      imports.push(template(prefix + COMMON_BASE_SKIN_PATH)(options));
    }
    imports.push(template(prefix + COMMON_PEAK_SKIN_PATH)(options));
    if (isThemeUsed) {
      const THEME_NAME_ARRAY = options.themeVersion.split(",");
      for(var i=0; i<THEME_NAME_ARRAY.length; i++) {
        var THEME_NAME_TEMP = (THEME_NAME_ARRAY[i].split("/")[2]).split("-")[0];
        var THEME_NAME = THEME_NAME_TEMP === 'base' ? 'base_theme' : THEME_NAME_TEMP;
        var themeTempPath = "<%= pluginPath %>" + THEME_NAME_ARRAY[i] + "/res/skins/" + THEME_NAME + "/sass";
        imports.push(template(themeTempPath)(options));
      }
    }
    return imports;
  }

  function themeSassPaths(forRemote) {
    const imports = [];
    const prefix = (forRemote ? REMOTE_THEME_PATH : TMP_THEME_PATH);
    // New theme in plugin/core
    const isThemeBaseUsed = !(options.themeBaseVersion == null);
    const isThemeSupportUsed = !(options.themeSupportVersion == null);
    const isThemeMarketingUsed = !(options.themeMarketingVersion == null);

    if (isThemeBaseUsed) {
      imports.push(template(prefix + THEME_BASE_SKIN_PATH)(options));
    }
    if (isThemeSupportUsed) {
      imports.push(template(prefix + THEME_SUPPORT_SKIN_PATH)(options));
    }
    if (isThemeMarketingUsed) {
      imports.push(template(prefix + THEME_MARKETING_SKIN_PATH)(options));
    }
    return imports;
  }

  return {
    tmpPluginNoReleasePath: template(TMP_PLUGIN_NO_RELEASE_PATH)(options),
    tmpPluginPath: template(TMP_PLUGIN_PATH)(options),
    tmpCountPath: template(TMP_COUNT_PATH)(options),
    tmpPluginWebPath: template(TMP_PLUGIN_WEB_PATH)(options),
    tmpCompilePath: template(TMP_COMPILE_PATH)(options),
    tmpCompileStylesPath: template(TMP_COMPILE_STYLES_PATH)(options),
    tmpCertDirPath: template(TMP_CERT_DIR_PATH)(options),
    tmpCertPath: template(TMP_CERT_PATH)(options),
    tmpCertKeyPath: template(TMP_CERT_KEY_PATH)(options),
    localServerBaseUrl: template(LOCAL_SERVER_BASE_URL)(options),
    localServerSkinUrl: template(LOCAL_SERVER_SKIN_URL)(options),
    pluginPath: template(PLUGIN_PATH)(options),
    customerSkinPath: template(CUSTOMER_SKIN_PATH)(options),
    customerSkinFilePath: template(CUSTOMER_SKIN_FILE_PATH)(options),
    customerSassFilePath: template(CUSTOMER_SASS_FILE_PATH)(options),
    customerPluginPath: template(CUSTOMER_PLUGIN_PATH)(options),
    customerPluginWatchPath: template(CUSTOMER_PLUGIN_WATCH_PATH)(options),
    customerPluginWatchIgnorePath: template(CUSTOMER_PLUGIN_WATCH_IGNORE_PATH)(options),
    customerResPath: template(CUSTOMER_RES_PATH)(options),
    customerWebPath: template(CUSTOMER_WEB_PATH)(options),
    serverPluginsCustomPath: template(SERVER_PLUGINS_CUSTOM_PATH)(options),
    serverCoreAngularLiPath: template(SERVER_CORE_ANGULAR_LI_PATH)(options),
    serverCoreThemePath: template(SERVER_CORE_THEME_PATH)(options),
    coreSassPaths: coreSassPaths,
    themeSassPaths: themeSassPaths,
    pluginReloadUrl: template(PLUGIN_RELOAD_URL)(options),
    featureVersionsUrl: template(FEATURE_VERSIONS_URL)(options)
  };
};


