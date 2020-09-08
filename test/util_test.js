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
	describe('top level util functions', async()=> {
		it('should be able to get eyefeats', async()=>{
			const eyefeats = await page.evaluate(async() =>{
				const videoElementCanvas = document.getElementById('webgazerVideoCanvas')
				return await webgazer.getTracker().getEyePatches(videoElementCanvas,videoElementCanvas.width,videoElementCanvas.height)
			})
			assert.isNotNull(eyefeats)
		})
		it('should be able to resize an eye', async() => {
			const resized_eye = await page.evaluate(async() => {
				const videoElementCanvas = document.getElementById('webgazerVideoCanvas')
				const eyeFeatures = await webgazer.getTracker().getEyePatches(videoElementCanvas,videoElementCanvas.width,videoElementCanvas.height)
				
				return Array.from(await webgazer.util.resizeEye(eyeFeatures.left,6,10).data);
			})
			assert.isNotNull(resized_eye)
		})
		it('should be able to grayscale an image', async() =>{
			const grayscale  =  await page.evaluate(async() => {
				const videoElementCanvas = document.getElementById('webgazerVideoCanvas')
				const eyeFeatures = await webgazer.getTracker().getEyePatches(videoElementCanvas,videoElementCanvas.width,videoElementCanvas.height)
				const resized_left = await webgazer.util.resizeEye(eyeFeatures.left,6,10)
				return Array.from(await webgazer.util.grayscale(resized_left.data,eyeFeatures.width,eyeFeatures.height))
			})
			assert.isNotNull(grayscale)
			
		})
		it('should be able to equalize a grayscaled image', async() =>{
			const equalizeHistogram  =  await page.evaluate(async() => {
				const videoElementCanvas = document.getElementById('webgazerVideoCanvas')
				const eyeFeatures = await webgazer.getTracker().getEyePatches(videoElementCanvas,videoElementCanvas.width,videoElementCanvas.height)
				const resized_left = await webgazer.util.resizeEye(eyeFeatures.left,6,10)
				const grayscale = await webgazer.util.grayscale(resized_left.data,eyeFeatures.width,eyeFeatures.height)
				return await webgazer.util.equalizeHistogram(grayscale,5,[])
			})
			assert.isNotNull(equalizeHistogram)
		})
		it('bound should adjust values to be within the appropriate range', async() =>{
			const width = await page.evaluate(async() => {
				return Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
			})
			const height = await page.evaluate(async() => {
				return Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
			})
			const lower_bound = await page.evaluate(async() => {
				return await webgazer.util.bound({x:-100,y:-100})
			})
			assert.equal(lower_bound.x,0)
			assert.equal(lower_bound.y,0)
			const upper_bound = await page.evaluate(async(width,height) => {
				return await webgazer.util.bound({x:width+10,y:height+10})
			}, width,height)
			assert.equal(upper_bound.x,width)
			assert.equal(upper_bound.y,height)
		})
		//TO-DO?  DataWindow testing
		
	})
})