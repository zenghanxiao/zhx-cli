import log from 'npmlog';
import isDebug from './isDebug.js';

log.addLevel('success', 2000, { fg: 'green', bold: true });

if (isDebug()) {
  log.level = 'verbose';
} else {
  log.level = 'info';
}

log.heading = 'zhx-cli';

export default log;