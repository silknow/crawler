const axios = require('axios');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');

class Utils {
  static async createPath(targetPath) {
    return new Promise((resolve, reject) => {
      fs.lstat(targetPath, err => {
        if (err) {
          if (err.code === 'ENOENT') {
            mkdirp(targetPath, e => {
              if (e) reject(e);
              else resolve();
            });
          } else {
            reject(err);
          }
        } else {
          resolve();
        }
      });
    });
  }

  static async downloadFile(url, filePath, options) {
    options = options || {};

    return Utils.createPath(path.dirname(filePath))
      .then(() =>
        axios({
          method: 'GET',
          url,
          responseType: 'stream',
          headers: options.headers
        })
      )
      .then(
        response =>
          new Promise((resolve, reject) => {
            // Pipe the result stream into a file on disc
            response.data.pipe(fs.createWriteStream(filePath));

            response.data.on('end', () => {
              resolve();
            });

            response.data.on('error', err => {
              fs.unlink(filePath);
              reject(err);
            });
          })
      );
  }
}

module.exports = Utils;
