const express = require('express');
const functions = require('firebase-functions');
const puppeteer = require('puppeteer');
const axios = require('axios');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const app = express();

initializeApp();
const db = getFirestore();


app.use(function cors(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  // res.header('Content-Type', 'application/json;charset=utf-8');
  // res.header('Cache-Control', 'private, max-age=300');
  next();
});

// const beforeMB = process.memoryUsage().heapUsed / 1e6;
// puppeteer.launch().then(browser => {
//   app.locals.browser = browser;
//   const afterMB = process.memoryUsage().heapUsed / 1e6;
//   console.log('used', beforeMB - afterMB + 'MB');
// })

app.get('/test', (req, res) => {
  res.status(200).send('test');
});

// Init code that gets run before all request handlers.
app.all('*', async (req, res, next) => {
  res.locals.browser = await puppeteer.launch({args: ['--no-sandbox']});
  next(); // pass control on to router.
});

app.get('/scrapeAll', async (req, res) => {
	const browser = res.locals.browser;
	let results = []
	for(var i = 1; i < 75; i++){
		const url = 'https://www.16personalities.com/articles?sortBy=date&sortByOrder=asc&page='+i
		results += await scrape(url, browser)
	}
	await browser.close();
	res.status(200).send(results);
});

app.get('/scrape', async (req, res) => {
	const url = req.query.url;
	if (!url) {
		return res
			.status(400)
			.send('Please provide a URL. Example: ?url=https://example.com');
	}
    
	const browser = res.locals.browser;
	let result = await scrape(url, browser);
	await browser.close();
	
	let status;
	if(result == "500: Error") status = 500; else status = 200;
	res.status(status).send(result);
});

app.get('/version', async (req, res) => {
  const browser = res.locals.browser;
  res.status(200).send(await browser.version());
  await browser.close();
});

async function scrape(url, browser) {
	try {
		const page = await browser.newPage();
		const response = await page.goto(url, {waitUntil: 'networkidle2'});
		functions.logger.log(response);

		await page.waitForSelector("article a");
	  
		const data = await page.evaluate(() => [...document.querySelectorAll("article > a")].map(it => it.href));
		functions.logger.log(data);
		
		const collection = db.collection('scraped');
		await collection
			.doc(url.replaceAll("/", "_"))
			.set({
				data: data,
				lastUpdated: Date.now()
			});	
		let domain = collection
			.doc(new URL(url).hostname)
		if((await domain.get()).exists)
			await domain
				.update({
					data: FieldValue.arrayUnion(...data),
					lastUpdated: Date.now()
				});
		else
			await domain
				.set({
					data: data,
					lastUpdated: Date.now()
				});
		
		functions.logger.log("Done scrapping");
		return data
	} catch (e) {
		functions.logger.error("Error", e);
		return "500: Error"
	}
}


exports.functions = functions.https.onRequest(app);
exports.functions5min = functions.runWith({timeoutSeconds: 300}).https.onRequest(app);

