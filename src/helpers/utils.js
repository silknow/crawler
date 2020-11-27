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

    await Utils.createPath(path.dirname(filePath));

    const urlInstance = new URL(url);
    if (urlInstance.protocol === 'file:') {
      return new Promise((resolve, reject) => {
        fs.copyFile(decodeURIComponent(urlInstance.pathname), filePath, err => {
          if (err) {
            reject(err);
            return;
          }
          resolve(filePath);
        });
      });
    }

    const axiosInstance = options.axios || axios;

    return axiosInstance({
      method: 'GET',
      url,
      responseType: 'stream',
      headers: options.headers
    }).then(
      response =>
        new Promise((resolve, reject) => {
          // Pipe the result stream into a file on disk
          response.data.pipe(fs.createWriteStream(filePath));

          response.data.on('end', () => {
            resolve(filePath);
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
