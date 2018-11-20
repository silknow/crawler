process.on('unhandledRejection', err => {
  throw err;
});

const crawlers = require('./crawlers');

let crawler;
Object.values(crawlers).forEach(Crawler => {
  if (process.argv[2] === Crawler.id) {
    crawler = new Crawler();
  }
});

if (crawler) {
  crawler
    .start()
    .then(() => {
      console.log('DONE!');
    })
    .catch(err => {
      console.error('Error:', err);
    });
}
