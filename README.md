# Services SDK

> A set of command line tools to make the life of a Services engineer easier. Primary tools are to compile 
and serve SASS; allow for quick modification and refresh of plugin assets against a deployed instance without 
having to manually commit to SVN or manually refresh plugin via world.

<a href="http://recordit.co/RMCpvSsK7m"><img src="https://cloud.githubusercontent.com/assets/207585/20304034/11dae134-aae3-11e6-96f7-093599ad3180.gif" width="750px"></a>

## Table Of Contents

* [Overview](#overview)
* [Installation](#installation)
* [Configuring App Instance](#configuring-app-instance)
  * [Local App Instance](#local-app-instance)
* [SSH Setup](#ssh-setup)
* [Anatomy of `config.json`](#anatomy-of-configjson)
  * [Configs Object](#configs-object)
  * [Hosts Object](#hosts-object)
  * [Example `config.json`](#example-configjson)
* [CLI - gulp commands](#cli---gulp-commands)
  * [Passing Config Overrides Via CLI](#passing-config-overrides-via-cli)
* [Using livereload](#using-livereload)
* [Using SASS Sourcemaps](#using-sass-sourcemaps)
  * [Editing SASS Files Directly in Chrome Dev Tools](#editing-sass-files-directly-in-chrome-dev-tools)
* [Auto commit to SVN](#auto-commit-to-svn)
* [Not Yet Supported and Known Issues](#not-yet-supported-and-known-issues)
* [Troubleshooting](#troubleshooting)
* [Change Log](#change-log)

## Overview

The `services-sdk` command line tool exposes `gulp` tasks to help with compiling and serving SASS as well as allowing for local file changes in your already-checked-out plugins to immediately updated and reflected on the app instance (local or remote). The SASS compilation works by rsync'ing the core responsive skin from the host where the application exists to your local machine and then uses [node-sass](https://github.com/sass/node-sass) to compile the skin from your locally checked out plugin. The compiled CSS is then put into a `.tmp` folder relative to the service-sdk directory. There is then another `gulp` task, `serve`, that starts a [node-connect](https://github.com/senchalabs/connect) local server that mounts the CSS in the `.tmp` folder along with images, fonts, and other assets in `web/` that the CSS references. The locally served CSS file can then be made to be [referenced in rendered pages](#Configuring-App-Instance) in the application. There is another gulp task, `watch`, that is then used to watch for file changes on the SASS files in the configured skin such that when they are changed it will trigger a re-compile and can be made to livereload the application (see [Using livereload](#Using-livereload)). The `watch` task also watches other files in the specified plugin that when changed will rsync the file to the plugin location on the host where the app is served (or disabled when working locally) and then send an API request to the app instance to flush the plugin cache for the specific asset type. The `watch` task will also trigger an auto-commit of the file to SVN when changed. Files not under version control will not be submitted - you can disable the auto-commit feature, see [Auto commit to SVN](#auto-commit-to-svn).
 
**[⬆ back to top](#table-of-contents)**

## Installation

1. Install [NodeJs](http://nodejs.org). I suggest moving up to the latest release version, at the time of writing this it is v6.9.1.
1. Optional: If you do not have github setup, follow these [install instructions](https://help.github.com/articles/set-up-git), setup a [credential helper](https://help.github.com/articles/caching-your-github-password-in-git/), [two factor authentication (2FA)](https://help.github.com/articles/providing-your-2fa-authentication-code/), and [an access token for command line use](https://help.github.com/articles/creating-an-access-token-for-command-line-use/). Still having issues, see this [troubleshooting page](https://help.github.com/articles/error-permission-denied-publickey/).
1. Optional: Avoid using sudo with npm; take ownership! Do not run this if you have already installed node/npm and 
have been using sudo to make it work.
    ```bash
    sudo chown -R $USER /usr/local
    ```

1. Install gulp-cli globally
    ```bash
    npm install --global gulp-cli
    ```

1. Clone the services-sdk repo. You can install it anywhere, I prefer: `~/dev`.
    ```bash
    cd ~/dev
    git clone https://github.com/lithiumtech/services-sdk.git
    ```
    
1. Install the npm dependencies in services-sdk
    ```bash
    cd services-sdk
    npm install
    ```
1. Initialize your local config file `config.json` and follow the instructions. See complete details about the [config](#anatomy-of-configjson) file below.
    ```bash
    gulp init-config
    ```

1. Add an item to your config file. The item will contain all the information for compiling against a stage site.
    ```bash
    gulp add-config
    ```
    
1. Run the compile and serve tool for the newly added config. You may wish to [configure your app instance](#configuring-app-instance) before starting this tool or it may not work correctly.
    ```bash
    gulp --config=customer.stage
    ```

This will start a local file server that is hosting the specified responsive skin at:

* HTTP: [http://localhost:9000/styles/responsive_peak.css](http://localhost:9000/styles/responsive_peak.css)
* HTTPS: [https://localhost:9001/styles/responsive_peak.css](https://localhost:9001/styles/responsive_peak.css)

**[⬆ back to top](#table-of-contents)**

## Configuring App Instance

These steps are temporary until a mechanism is added that allows a URL for a CSS to be specified by passing a custom header. 
The App Instance be either be a remote instance running on a VM or a [local instance](#local-app-anstance). 

1. Add the following to the app instance config file for your stage site:
    ```bash
    ## This exposes an API that can only be used in non-prod environments to refresh the plugin assets
    enable.ExperimentalApi = true
    
    
    ## Enable the LAR tool - don't worry were not actually using LAR just something unrelated that uses this config
    enable.LarTool = true
    ```

1. (Optional) If your community has the `config.disable_anonymous_access` setting enabled then you will want to add this config. This will be added by default in 16.11.
   ```bash
   jsp.anon_access_ok_urls += /${tapestry.context.name}/api/.*
   ```

1. Login to your community as a user with Studio access, preferably only one you will be using.
1. Go to `Studio>>Advanced>>SDK`
1. Enable the `Override Skin CSS URL` checkbox
1. Select the radio button for the `Responsive Skin ID` you are using
1. Set the `Responsive Skin CSS URL` to one of the following (adjust accordingly if you have overridden the config values that impact this URL: `https`, `httpPort`, `httpsPort`, and `compiledSkinName`):
  * For HTTP: http://localhost:9000/styles/responsive_peak.css
  * For HTTPS: http://localhost:9001/styles/responsive_peak.css
  
### Local App Instance

When using a local instance be sure to set the `hostName`, `https`, `httpPort`, and `httpsPort` values to match your 
local app instance. You may also wish to disable the `syncToRemote` option so that local plugin changes do not get 
sent to the plugin for the app instance on the remote VM (typically used for livereload0. Also, you may wish to disable 
the `autoCommit` option so that you can bundle more changes in a single commit that you run manually. A config item setup 
for you local might look something like:

```json
...
"lithcx.qa": {
  "customerId": "sandbox",
  "communityId": "lithcx",
  "pluginId": "lithcx",
  "host": "qa-mansites01.qa.lithium.com",
  "hostname": "localhost",
  "tapestryContext": "t5",
  "restapiContext": "corecom",
  "phase": "qa",
  "liaRelease": "active",
  "skin": "responsive_16_dot_8",
  "https": false,
  "httpPort": 8080,
  "syncToRemote": false,
  "autoCommit": false
}
...
```

**[⬆ back to top](#table-of-contents)**

## SSH Setup

The tool requires ssh access to the remote host VMs where the app instance is hosted. You likely already have ssh
access to the host VMs, if so you're key is likely located at `~/.ssh/id_rsa-<first-name>_<last-name>` (assuming you 
followe our naming conventions). If you have not setup a key you can set it up following these instructions for 
[creating server access ssh keys](https://confluence.dev.lithium.com/display/TechOps/Creating+Server+Access+SSH+Keys).
If you already have an ientity file (or once you have one registered) I recommend that you use `ssh-add` to register 
the identity file so that you do not need to type your passphrase (assuming you used one) every time you use this tool.
This might look something like (change the identity file name/path accordingly):

```
ssh-add ~/.ssh/id_rsa-adam_ayres
```

**[⬆ back to top](#table-of-contents)**

## Anatomy of `config.json`

The `config.json` file is created by the `gulp init-config` command and will be populated based on the answers provided. 
The config contains a map of `configs` and `hosts`. 

### Configs Object

The `configs` map contains all of the communities that you will be working with locally. The `configs` map may 
contain a `default` key whose property will be provided as a default for all other config objects. This can be useful 
for specifying the `pluginPath` property which is a relative or absolute path to the location of the checked out 
plugin on your local machine - if used as a relative path it would be relative to location of the services-sdk 
directory created for this repo. You can add new configs to the `configs` object by using the `gulp add-config` command.

#### Config Object Values 

The following config values can either be set in the `configs.default` object or an individual object in `configs`. If 
a value does not exist in the `confits` map then the one from the `configs.default` will be used.

* `configs` _\<Object\>_ Map of configs, contains the defaults under special key: `default`. All other first-order children are keys for `configNames`. The following are allowed properties of a named config (or the default). 
  * `customerId` _\<String\>_ The customer id. Defaults to: `null`.
  * `communityId` _\<String\>_ The community id. Defaults to: `null`.
  * `pluginId` _\<String\>_ The plugin id. Defaults to: `null`.
  * `phase` _\<String\>_ 'The plugin phase to use. Defaults to: `stage`.
  * `pluginPath` _\<String\>_ Relative or absolute path to where all your plugins are checked out. Defaults to: `../plugins/custom`.
  * `skin` _\<String\>_ Skin id that will be compiled and served. Defaults to: `responsive_peak`.
  * `compiledSkinName` _\<String\>_ Name of the compiled skin file. Defaults to: `responsive_peak.css`.
  * `liaRelease` _\<String\>_ The lia release the customer is on. Defaults to: `16.10`.
  * `responsiveVersion` _\<Number\>_ , The version of responsive being used. Defaults to: `2.0`.
  * `tmpPathBase` _\<String\>_ Relative or absolute path where temporary files will be stored, like the compiled CSS. Defaults to: `./.tmp`.
  * `sass` _\<Object\>_ SASS config options. Defaults below.
    * `precision` _\<String\>_ SASS precision. Defaults to: `10`.
  * `host` _\<Object\>_ Host config value. Defaults below.
    * `sshIdentityFile` _\<String\>_ Ssh identity file to host. Defaults to: `~/.ssh/id_rsa-<firstName>_<lastName>`.
    * `sshUsername` _\<String\>_ Ssh username to host. Defaults to: `null`.  
  * `hostname` _\<String\>_ Config value for: hostname. Defaults to: `null`.
  * `tapestryContext` _\<String\>_ Config value for: tapestry.context.name. Defaults to: `t5`.
  * `restapiContext` _\<String\>_ Config value for: appserver.restapi.contexts. Defaults to: `null`.
  * `https` _\<Boolean\>_ Use https for app server requests. Defaults to: `true`.
  * `httpPort` Http port for app server requests. Defaults to: `80`.
  * `httpsPort` Https port for app server requests. Defaults to: `443`.
  * `localServer` _\<Object\>_ Local server options used for serving compiled CSS along with images and fonts. Defaults below.
    * `httpPort` _\<Number\>_ Local server http port. Defaults to: `9000`.
    * `httpsPort` _\<String\>_ Local server https port. Defaults to: `9001`.
  * `liveReload` _\<Boolean\>_ Whether to use local livereload server. Defaults to: `true`.
  * `autoCommit` _\<String\>_ Whether the plugin changes are automatically committed to SVN. Defaults to: `true`.
  * `syncToRemote`: _\<Boolean\>_ Whether local plugin asset changes are sync'd to the plugin on the remote VM. Defaults to: `true`.
  * `checkFileChanged`: _\<Boolean\>_ When enabled an in-mem cache of the file contents is stored every time it is changed and compared against itself for any future changes. When contents are the same then the file watcher action will not be performed. This is to work around an issue in Windows where the SVN commands would trigger the file watch action despite having no change to the contents. Defaults to: `false`.
  * `theme`: _\<Boolean\>_ Whether community theme is used. Defaults to: `false`. (deprecated)
  * `themeVersion`: _\<String\>_ theme version/name used for community. (deprecated)
  * `themeBaseVersion`: _\<String\>_ Base theme version/name used for community. Defaults to: `null`.
  * `themeMarketingVersion`: _\<String\>_ Support theme version/name used for community. Defaults to: `null`.
  * `themeSupportVersion`: _\<String\>_ Support theme version/name used for community. Defaults to: `null`.

### Hosts Object

The `hosts` map contains all of the hosts where the communities exists that you will be working with (remotely). The 
`hosts` map may contain a `default` key whose property will be provided as a default for connecting to hosts. This can 
be useful for specifying the `sshIdentityFile` property which is a relative or absolute path to the location of your 
ssh identity file used to connect to the remote host - if used as a relative path it would be relative to location of 
the services-sdk directory created for this repo. You can add new hosts to the `hosts` object by using 
the `gulp add-host` command.

#### Host Object Values 

The following config values can either be set in the `hosts.default` object or an individual object in `hosts`. If
a value does not exist in the `hosts` map then the one from the `hosts.default` will be used.

* `configs` _\<Object\>_ Map of hosts, contains the defaults under special key: `default`. All other first-order children are keys for hosts. The following are allowed properties of a named host (or the default). 
  * `sshIdentityFile` _\<String\>_ Relative or absolute path to the SSH identity file used to connect to remote host. Defaults to: `null`.
  * `sshUsername` _\<String\>_ Not needed when `sshIdentityFile` is set, which is preferred. SSH username used to connect to the remote host. Defaults to: `null`.

### Example `config.json`

```json
{
  "configs": {
    "default": {
      "pluginPath": "../lia/plugins/custom",
      "liveReload": true,
      "autoCommit": true,
      "syncToRemote": true
    },
    "lithosphere.stage": {
      "customerId": "lithium",
      "communityId": "lithosphere",
      "pluginId": "lithosphere2",
      "host": "sjc1sapp06.sj.lithium.com",
      "hostname": "lithosphere.stage.lithium.com",
      "tapestryContext": "t5",
      "restapiContext": "lithosphere",
      "phase": "stage",
      "liaRelease": "16.10",
      "https": true,
      "httpPort": 80,
      "httpsPort": 443,
      "skin": "testresponsive1",
      "theme": true,
      "themeVersion": "support-v1.1"
    },
    "ps107.stage": {
      "customerId": "lithium",
      "communityId": "ps107",
      "pluginId": "ps107",
      "host": "sjc1sapp10.sj.lithium.com",
      "hostname": "ps107.stage.lithium.com",
      "tapestryContext": "t5",
      "restapiContext": "ps107",
      "phase": "stage",
      "liaRelease": "17.9",
      "https": true,
      "httpPort": 80,
      "httpsPort": 443,
      "themeBaseVersion": "1.1",
      "themeSupportVersion": "1.1",
      "responsiveVersion": "2.0",
      "skin": "ps107"
    },
  },
  "hosts": {
    "default": {
      "sshIdentityFile": "~/.ssh/id_rsa-adam_ayres"
    },
    "sjc1sapp01.sj.lithium.com": {
      "host": "sjc1sapp01.sj.lithium.com",
      "sshIdentityFile": "~/.ssh/id_rsa-some-other-rsa"
    }
  }
}
```

**[⬆ back to top](#table-of-contents)**

## CLI - gulp commands

The CLI is set of tools primarily based on [gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md). 
Documented below are the gulp targets that are supported.

### `gulp`

Default task that runs the `serve`, `sync-remote`, `watch` tasks. Expects the `--config` argument to be specified and 
that matches a config item in `config.json`.

### `gulp serve`

Starts a local server on port 9000 that serves the CSS, font files, and images used by the CSS. Expects the `--config` argument.

### `gulp sync-remote`

Pulls the core Responsive skins from the customer instance and stores it locally for compilation. Expects the `--config` argument.

### `gulp watch`

Starts file watchers on the `res` and `web` directories for the specified local plugin. Expects the `--config` argument.

### `gulp init-config`

Initializes the `config.json` file that stores the information for the various app instances and plugins used.

### `gulp add-config`

Adds an item to the `config.json` for an app instance and it's plugin. You will be prompted to fill in the details of 
the config you wish to add. The tool attempts to lookup the config values for the item using the an internal API. If
located then most of the questions will be skipped, however if you wish to manually enter them all you can use the 
`--inquireAll` flag when using this task.

### `gulp add-host`

Adds an item to the `config.json` used for connecting to a host where an app instance lives.

### `gulp clean`

Deletes the `.tmp` folder that is used to store the core Responsive skin files and the compiled CSS.

### Passing Config Overrides Via CLI

All options in the config, that are not nested properties (like `localServer`) can be overridden from the 
CLI. This can be useful for overriding values without having to change the `config.json`. Examples


**Temporarily disable autocomplete**

```bash
gulp --config=lithosphere.stage --autoCommit=false
```

**Temporarily use a local app instance on port 8080, not using HTTPS, and not syncing plugin changes from local to remote. Note, all of these could be set as defaults.
```bash
gulp --config=lithosphere.stage --hostname=localhost --httpPort=8080 --https=false --syncToRemote=false
```

**Output all files being watched**
```bash
gulp --config=lithosphere.stage --showFilesWatched
```

**Change debug level, defaults to "info", possible levels: debug, info, warn, error.**
```bash
gulp --config=lithosphere.stage --loggingLevel=debug
```

**Add JIRA id while commit (this is applicable when autoCommit is true).**
```bash
gulp --config=lithosphere.stage --jira=PSO-16147
```

**[⬆ back to top](#table-of-contents)**

## Using livereload

1. Install one of the livereload browser plugins listed below
1. Start the `gulp` task for your app/plugin
1. Go to the app in your browser and enable the livereload plugin
1. Any file changes in the plugin should trigger a reload of the page - please note that CSS reloads are done without refreshing the browser, they are hot-swapped in without a reload.

* [Chrome Plugin](https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei?hl=en)
* [Firefox Plugin](https://addons.mozilla.org/en-Us/firefox/addon/livereload/)
* [Safari Plugin](http://download.livereload.com/2.1.0/LiveReload-2.1.0.safariextz)

**[⬆ back to top](#table-of-contents)**

## Using SASS Sourcemaps

The local SASS compile is setup to embed the entire source maps into the compiled CSS file. When inspecting the code
 in a browser that supports sourcemaps (like Chrome or Firefox) you should see the coude as it exists in the original 
 SASS files. 
 
**[⬆ back to top](#table-of-contents)**
 
### Editing SASS Files Directly in Chrome Dev Tools

Chrome Dev Tools has a feature that allows for the SASS to be edited and saved to your file system in their original location.
When this file save occurs it will trigger the file watcher and a re-compile, the livereload will then hotswap in the 
updated CSS code all from the context of Dev Tools. To enable this feature open Chrome Dev Tools and go to the Source tab.
On the Source tab right click in the area where the tree browser of files exist and click the option to `Add Folder to Workspace`.
Navigate to the skin folder in the plugin you plan to work with - you will need to do this for each plugin/skin or just 
add the root plugin folder. A browser notification will appear at the top of the browser requesting access to your file 
system, approve the request. Next, when inspecting elements (from the Elements tab) and navigating through the styles
 from the Styles sub tab click into a SASS file from the customer's skin. In the stylesheet view right click againg and 
 select Map To Network Resource. In the dropdown menu select the file from the mapped resource. Once mapped file changes
 will trigger a save on the file system and when the `gulp` watcher is running it will trigger the compile and livereload.
  
**[⬆ back to top](#table-of-contents)**

## Auto commit to SVN

By default the `gulp` task (and the `watch` task it uses) will auto-commit files changed in your local plugin when changed. You can disable this feature by setting the using the `--autoCommit=false` flag. Example: `gulp --config=customer.phase --autoCommit=false`.

**[⬆ back to top](#table-of-contents)**

## Not Yet Supported and Known Issues

* Skins that reference assets from other customer skins (might work but not verified)
* Support for sites other than stage (might work but not verified)
* When saving multiple files at once only once file gets committed to SVN.
* Adding new files locally that are not under SVN control give an error in the log and do not get committed.

**[⬆ back to top](#table-of-contents)**

## Troubleshooting

### `Permission denied (publickey).` during `git clone`
 
**Error**

```bash
Cloning into 'services-sdk'...
Warning: Permanently added the RSA host key for IP address '192.30.253.112' to the list of known hosts.
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Resolution**

See step two of [Installation](#installation). Make sure you have [two factor authentication (2FA)](https://help.github.com/articles/providing-your-2fa-authentication-code/) and [an access token for command line use](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) setup. You might also read this github document on [which remote URL to use when cloning](https://help.github.com/articles/which-remote-url-should-i-use/) and this github document on the [error permission denied public key](https://help.github.com/articles/error-permission-denied-publickey/). Also make sure that you do NOT have something like the following in your `.~gitconfig` file:

**Remove this from your `.gitconfig` if it exists.**
```
[url "git://"]
    insteadof = https://
```

**[⬆ back to top](#table-of-contents)**

## Change Log

**1.0.0**

Initial release!

**[⬆ back to top](#table-of-contents)**
