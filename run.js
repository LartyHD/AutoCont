const puppeteer = require('puppeteer');
const axios = require('axios');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

initializeApp({
	credential: applicationDefault()
});

const db = getFirestore();

(async () => {
  const browser = await puppeteer.launch();
  
  for(var i = 1; i < 75; i++){
  
	const page = await browser.newPage();
	const url = 'https://www.16personalities.com/articles?sortBy=date&sortByOrder=asc&page='+i
	await page.goto(url);
	  
	await page.waitForSelector("article a");
	  
	const data = await page.evaluate(() => [...document.querySelectorAll("article > a")].map(it => it.href));
	  
	console.log(data)
	console.log(typeof(data))
	  
	const docRef = db.collection('scraped').doc(url.replace("/", "_"));

	await docRef.set({
		data: data,
		lastUpdated: Date.now()
	});

  }

  await browser.close();
})();



	
