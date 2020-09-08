const puppeteer = require('puppeteer');
const { assert } = require('chai');
const TFFaceMesh = require('@tensorflow-models/facemesh');

describe('regression functions', async()=> {
	let browser,page;
	before(async() =>{
		const parent_dir = __dirname.substring(0,__dirname.length-4)
		let my_y4m_video = parent_dir + 'www/data/src/P_01/dot.y4m'
		browser = await puppeteer.launch({args:['--use-file-for-fake-video-capture='+my_y4m_video,
		'--allow-file-access', '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
		'--no-sandbox','--disable-setuid-sandbox',
		]
		//,devtools:true //enable for debugging
		});
		page = await browser.newPage();
		await page.goto('http://localhost:3000/calibration.html?');
		page.coverage.startJSCoverage();


		await page.waitFor(1500)
			await page.waitForSelector('#start_calibration')
			//calibration button is not immediately clickable due to css transition
			await page.waitFor(2500)

		await page.evaluate(async() => {
			document.querySelector("#start_calibration").click()
		})
		await page.waitFor(1500)
		await page.evaluate(async() =>{
			document.querySelector("body > div.swal-overlay.swal-overlay--show-modal > div > div.swal-footer > div > button").click()
		})
	})

	after(async () => {
		const jsCoverage = await page.coverage.stopJSCoverage();
		let usedBytes = 0;
		//assuming 0 is webgazer.js
		jsCoverage[0].ranges.forEach(range => (usedBytes += range.end - range.start - 1));
		console.log((100*usedBytes/jsCoverage[0].text.length).toFixed(4), "% Code Coverage on webgazer.js")
		await browser.close();
	})
	describe('top level functions', async()=> {
		it('default regression should be ridge and it should have default properties', async() =>{
			const regression_set = await page.evaluate(async() => {
				return await webgazer.getRegression()
			})
			//assert.equal(regression_set[0].name,"ridge")
			assert.isNotNull(regression_set[0].dataClicks)
			assert.isNotNull(regression_set[0].dataTrail)
			assert.isNotNull(regression_set[0].eyeFeaturesClicks)
			assert.isNotNull(regression_set[0].eyeFeaturesTrail)
			assert.isNotNull(regression_set[0].kalman)
			assert.isNotNull(regression_set[0].ridgeParameter)
			assert.isNotNull(regression_set[0].screenXClicksArray)
			assert.isNotNull(regression_set[0].screenYClicksArray)
			assert.isNotNull(regression_set[0].screenXTrailArray)
			assert.isNotNull(regression_set[0].screenYTrailArray)
			assert.isNotNull(regression_set[0].trailDataWindow)
			assert.isNotNull(regression_set[0].trailTime)
			assert.isNotNull(regression_set[0].trailTimes)
		})

		it('mouse clicks and moves should be stored in regs', async()=>{
			await page.mouse.click(500,600)
			let regsClicksArray = await page.evaluate(async()=>{
				return {x:await webgazer.getRegression()[0].screenXClicksArray.data[1],
						y:await webgazer.getRegression()[0].screenYClicksArray.data[1]}
			})
			assert.equal(regsClicksArray.x,500)
			assert.equal(regsClicksArray.y,600)

			await page.mouse.move(50, 60);
			let regsTrailArray = await page.evaluate(async()=>{
				return {x:await webgazer.getRegression()[0].screenXTrailArray.data[0],
						y:await webgazer.getRegression()[0].screenYTrailArray.data[0]}
			})
			assert.equal(regsTrailArray.x[0],50)
			assert.equal(regsTrailArray.y[0],60)
		})
		it('should be able to store points', async()=>{
			const points = await page.evaluate(async()=>{
				await webgazer.storePoints(100, 200, 0)
				return await webgazer.getStoredPoints() 
			})
			assert.equal(points[0][0],100)
			assert.equal(points[1][0],200)
		})
		it('should return regression data', async()=> {
			await page.evaluate(async() => {
				document.getElementsByClassName('Calibration')[0].click()
				
			})
			let regs = await page.evaluate(async()=>{
				return await webgazer.getRegression()
			})
			assert.isNotNull(regs)
		})
		it('should make predictions', async()=>{
			const prediction = await page.evaluate(async() => {
				return await webgazer.getCurrentPrediction()
			})
			
			console.log(prediction)
			assert.isNotNull(prediction)
		})

		it('should be able to add a new regression', async()=>{
			const new_regression = await page.evaluate(async() => {
				webgazer.addRegression("weightedRidge")
				return await webgazer.getRegression()[1]
			})
			assert.isNotNull(new_regression)
			assert.isNotNull(new_regression.dataClicks)
			assert.isNotNull(new_regression.dataTrail)
			assert.isNotNull(new_regression.eyeFeaturesClicks)
			assert.isNotNull(new_regression.eyeFeaturesTrail)
			assert.isNotNull(new_regression.kalman)
			assert.isNotNull(new_regression.ridgeParameter)
			assert.isNotNull(new_regression.screenXClicksArray)
			assert.isNotNull(new_regression.screenYClicksArray)
			assert.isNotNull(new_regression.screenXTrailArray)
			assert.isNotNull(new_regression.screenYTrailArray)
			assert.isNotNull(new_regression.trailDataWindow)
			assert.isNotNull(new_regression.trailTime)
			assert.isNotNull(new_regression.trailTimes)	
		})
	})
	describe("regression predictions", async()=>{
		it('should return null when prediction is called with no eyesObjects', async()=>{
			const no_eyes_prediction = await page.evaluate(async() => {
				return await webgazer.getRegression()[0].predict()
			})
			assert.isNull(no_eyes_prediction)
		})
		it('should return a prediction when eyesObject is valid', async()=>{
			const eyes_prediction = await page.evaluate(async() => {
				const videoElementCanvas = document.getElementById('webgazerVideoCanvas')
				const eyeFeatures = await webgazer.getTracker().getEyePatches(videoElementCanvas,videoElementCanvas.width,videoElementCanvas.height)
				return await webgazer.getRegression()[0].predict(eyeFeatures)
			})
			assert.isNotNull(eyes_prediction)
		})
		it('Kalman filter should exist and have properties', async()=>{
			const kalman_applied = await page.evaluate(async() => {
				return window.applyKalmanFilter
			})
			assert.equal(kalman_applied,true)
			const kalman_filter = await page.evaluate(async() => {
				return webgazer.getRegression()[0].kalman
			})
			assert.isNotNull(kalman_filter.F)
			assert.isNotNull(kalman_filter.H)
			assert.isNotNull(kalman_filter.P)
			assert.isNotNull(kalman_filter.Q)
			assert.isNotNull(kalman_filter.R)
			assert.isNotNull(kalman_filter.X)
		})
		it('Kalman filter should be updateable', async()=>{
			const kalman_filter_upgdate = await page.evaluate(async() => {
				return webgazer.getRegression()[0].kalman.update([500,500])
			})
			assert.isNotNull(kalman_filter_upgdate)

		})
	})			
})
