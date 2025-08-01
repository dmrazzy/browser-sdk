// Capabilities: https://www.browserstack.com/automate/capabilities

/**
 * @type {Array<import('../browsers.conf').BrowserConfiguration>}
 */
const browserConfigurations = [
  {
    sessionName: 'Edge',
    name: 'Edge',
    version: '80.0',
    os: 'Windows',
    osVersion: '11',
  },
  {
    sessionName: 'Firefox',
    name: 'Firefox',
    version: '67.0',
    os: 'Windows',
    osVersion: '11',
  },
  {
    sessionName: 'Safari desktop',
    name: 'Safari',
    version: '12.1',
    os: 'OS X',
    osVersion: 'Mojave',
  },
  {
    sessionName: 'Chrome desktop',
    name: 'Chrome',
    version: '63.0',
    os: 'Windows',
    osVersion: '11',
  },
  {
    sessionName: 'Chrome mobile',
    name: 'chrome',
    os: 'android',
    osVersion: '12.0',
    device: 'Google Pixel 6 Pro',
  },
  {
    sessionName: 'Safari mobile',
    name: 'safari',
    os: 'ios',
    osVersion: '15',
    device: 'iPhone 13',
  },
]

module.exports = {
  browserConfigurations,
}
