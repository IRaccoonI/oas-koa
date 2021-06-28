#!/usr/bin/env node
'use strict';

const { ArgumentParser } = require('argparse');
// const { createFunctionTypeNode } = require('typescript');

const fs = require('fs');
const path = require('path');

const request = require('request');
const execSync = require('child_process').execSync;

const currentFileName = 'current.ts';
const openapisPath = path.join('src', 'openapis');
const reVersion = /^.*?(?<version>(?:\d+_)*\d+).*?/;

const type2extract = [
  { type_name: 'Swagger', as: 'url' },
  { type_name: 'X-Version', as: 'version' },
  { type_name: 'X-Published', as: 'published' },
  { type_name: 'X-Private', as: 'private' },
];

const parser = new ArgumentParser({
  description: 'Work with Swagger as types',
});

let subparsers = parser.add_subparsers({
  title: 'subcommands',
  dest: 'cmd',
});

subparsers.add_parser('pull', { add_help: true });
const sb = subparsers.add_parser('version', { add_help: true });
sb.add_argument('-l', '--latest', {
  help: 'Set latest version',
  action: 'store_true',
});
sb.add_argument('-a', '--list-all', {
  help: 'Show all able versions',
  action: 'store_true',
});
sb.add_argument('-s', '--set', {
  help: 'Show all able versions',
});

const args = parser.parse_args();

if (args.cmd === 'version') {
  if (args.latest) {
    setLatestVersion();
  } else if (args.set) {
    setVersion(args.set);
  } else if (args.list_all) {
    getListVersions();
  }
} else if (args.cmd === 'pull') {
  pull();
}

function pull() {
  // https://app.swaggerhub.com/apiproxy/registry/IRaccoonI/ruppur-api
  const API_CONFIG_URL_STR = process.env.SWAGGER_URL.replace('apis', 'apiproxy/registry');
  const API_CONFIG_URL = new URL(API_CONFIG_URL_STR);
  let options = {
    url: API_CONFIG_URL_STR,
    method: 'GET',
    json: true,
  };
  const installedVersionsOpenTS = getIstalledVersionsOpenTS();
  request(options, function (error, response, body) {
    const cfg = body.apis.map((api) => apiParse(api));
    cfg.map((swagger) => {
      if (!swagger.published) return;
      if (installedVersionsOpenTS.includes(swagger.version)) return;
      const yamlUrl = swagger.url.replace('apis', 'apiproxy/registry').replace('https://api', 'https://app');
      const output = execSync('npx openapi-typescript ' + yamlUrl, { encoding: 'utf-8' }); // the default is 'buffer'
      const openapiFileName = version2fileName(swagger.version);
      fs.writeFileSync(path.join(openapisPath, openapiFileName), output, { encoding: 'utf-8' });
    });
  });
}

function getListVersions() {
  getIstalledVersionsOpenTS().map((v) => console.log(v));
}

function setLatestVersion() {
  const apisVersions = getIstalledVersionsOpenTS();
  const maxVarsion = 100;
  const maxVersionPoints = 5;
  const versionsWithWeights = Object.fromEntries(
    apisVersions.map((v) => [
      v,
      v
        .split('.')
        .reduce((prev, current, ind) => prev + parseInt(current) * Math.pow(maxVarsion, maxVersionPoints - ind - 1), 0),
    ]),
  );
  const latest = Object.entries(versionsWithWeights).reduce((a, b) => (a[1] > b[1] ? a : b))[0];
  setVersion(latest);
}

function setVersion(version) {
  const fn = version2fileName(version);
  const content = fs.readFileSync(path.join(openapisPath, fn), { encoding: 'utf-8' });
  fs.writeFileSync(path.join(openapisPath, currentFileName), content, { encoding: 'utf-8' });
}

// Parse swaggerhub
const extractingTypes = type2extract.map((item) => item.type_name);
function apiParse(api) {
  return Object.fromEntries(
    // contains [{type: str, value: str}]
    api.properties
      // filter for only intresting props
      .filter((prop) => extractingTypes.includes(prop.type))
      // save props
      .map((prop) => [
        type2extract.filter((item) => prop.type == item.type_name)[0].as,
        prop.type == 'Swagger' ? prop.url : prop.value,
      ]),
  );
}

// file workers
// find all openapi_x_x_x.ts as ['x.x.x', ...]
function getIstalledVersionsOpenTS() {
  if (!fs.existsSync(openapisPath)) {
    fs.mkdirSync(openapisPath);
  }
  var filesNames = fs.readdirSync(openapisPath);
  return filesNames
    .filter((fn) => fn != '.gitkeep' && fn != currentFileName)
    .map((fn) => fn.match(reVersion).groups.version.replaceAll('_', '.'));
}

function version2fileName(version) {
  return 'openapi_' + version.replaceAll('.', '_') + '.ts';
}
