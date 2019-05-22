const { argv } = require('yargs');

const crawlers = require('./crawlers');

process.on('unhandledRejection', err => {
  throw err;
});

const targetCrawlers = [];

argv._.forEach(crawlerName => {
  const crawler = Object.values(crawlers)
    .filter(c => c.id === crawlerName)
    .pop();
  if (!crawler) {
    console.error(`Crawler not found: ${crawlerName}`);
  } else {
    targetCrawlers.push(crawler);
  }
});

if (!targetCrawlers.length) {
  console.log(
    `No crawler selected. Crawlers available: ${Object.values(crawlers)
      .map(c => c.id)
      .join(', ')}`
  );
} else {
  (async () => {
    for (const Crawler of targetCrawlers) {
      try {
        const crawler = new Crawler(argv);
        console.log(`Running crawler "${crawler.constructor.id}"`);
        await crawler.start();
      } catch (err) {
        console.error('Error:', err);
      }
    }
  })();
}
