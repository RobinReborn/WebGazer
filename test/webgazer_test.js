const puppeteer = require('puppeteer');
const { assert } = require('chai');
const TFFaceMesh = require('@tensorflow-models/facemesh');

function startTimer() {
   const time = process.hrtime();
   return time;
 }

 function endTimer(time) {
   const diff = process.hrtime(time);
   const NS_PER_SEC = 1e9;
   const result = (diff[0] * NS_PER_SEC + diff[1]); // Result in Nanoseconds
   return elapsed = result * 0.000001; //milliseconds
 }

describe('webgazer function', async() => {
	let browser,page;
	before(async () => {
		//convert .webm to mp4 https://cloudconvert.com/webm-to-mp4
		//convert mp4 to y4m with:
		//ffmpeg -i 1491487691210_2_-study-dot_test_instructions.webm -pix_fmt yuv420p dot.y4m
		//sed -i '0,/C420mpeg2/s//C420/' *.y4m (make accessible to chrome)
		//give absolute path!
		//(I'm sure there's a more efficient way of doing this but final file must be .y4m with header for chrome)
		let my_y4m_video = '/home/robin/workspace/WebGazer/www/data/src/P_64/dot.y4m'
		browser = await puppeteer.launch({args:['--use-file-for-fake-video-capture='+my_y4m_video,
		'--allow-file-access', '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
		'--no-sandbox','--disable-setuid-sandbox',
		]
		,devtools:true //enable for debugging
		});
		page = await browser.newPage();
		await page.goto('http://localhost:3000/calibration.html?');
		page.coverage.startJSCoverage();
	})

	after(async () => {
		const jsCoverage = await page.coverage.stopJSCoverage();
		let usedBytes = 0;
		jsCoverage.forEach(range => (usedBytes += range.end - range.start - 1));
	  	const calculateUsedBytes = (type, coverage) =>
	    	coverage.map(({url, ranges, text }) => {
	      		let usedBytes = 0;
	      		ranges.forEach(range => (usedBytes += range.end - range.start - 1))
	      		//this is inaccurate when all tests are run together
	      		if(url=='http://localhost:3000/webgazer.js')
					console.log((100*usedBytes/text.length).toFixed(2), "% Code Coverage on webgazer.js")
			});
		calculateUsedBytes('js',jsCoverage);
		await browser.close();
	})
	it('should be able to recognize video input', async() =>{
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
		const videoAvailable = await page.evaluate(async() => {
			return await webgazer.params.showFaceFeedbackBox;
		});
		const isReady = await page.evaluate(async() => {
			return await webgazer.isReady()
		});
		assert.equal(videoAvailable,true);
		assert.equal(isReady,true);
	});
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

	//modifying visibility params
	it('webgazerVideoFeed should display', async() => {
		let video_display = await page.evaluate(async() => {
			return document.getElementById('webgazerVideoFeed').style.display
		})
		assert.notEqual(video_display,"none");
	})
	it('webgazerFaceFeedbackBox should display', async() => {
		await page.waitForSelector('#webgazerFaceFeedbackBox')
		let face_overlay = await page.evaluate(async() => {
			return document.getElementById('webgazerFaceFeedbackBox').style.display
		})
		assert.notEqual(face_overlay,"none");
	})
	it('webgazerGazeDot should display', async() => {
		let webgazer_gazedot = await page.evaluate(async() => {
			return document.getElementById('webgazerGazeDot').style.display
		})
		assert.notEqual(webgazer_gazedot,"none");
	})
	it('faceoverlay should hide when showFaceOverlay is false', async() => {
		face_overlay = await page.evaluate(async() => {
			await webgazer.showFaceFeedbackBox(false)
			return document.getElementById('webgazerFaceFeedbackBox').style.display
		})
		assert.equal(face_overlay,"none");
	})
	it('webgazerGazeDot should hide when showPredictionPoints is false', async() =>{
		let webgazer_gazedot = await page.evaluate(async() => {
			await webgazer.showPredictionPoints(false)
			return document.getElementById('webgazerGazeDot').style.display
		})
		assert.equal(webgazer_gazedot,"none");
	})
	it('webgazerVideoFeed should hide when showVideo is false', async() => {
		video_display = await page.evaluate(async() => {			
			await webgazer.showVideo(false)
			return document.getElementById('webgazerVideoFeed').style.display
		});
		assert.equal(video_display,"none");
	})
	it('getVideoElementCanvas should exist and be a canvas element', async() => {
		let video_element_canvas_type = await page.evaluate(async() => {
			return await webgazer.getVideoElementCanvas().nodeName
		})
		assert.equal(video_element_canvas_type,'CANVAS')
	})
	it('preview to camera resolution ratio should be [0.5,0.5]', async() =>{
		let preview_to_camera_resolution_ratio = await page.evaluate(async() => {
			return await webgazer.getVideoPreviewToCameraResolutionRatio()
		})
		assert.equal(preview_to_camera_resolution_ratio[0],0.5)
		assert.equal(preview_to_camera_resolution_ratio[1],0.5)
	})
	it('should be able to change video viewer size', async()=>{
		const video_dimensions = await page.evaluate(async()=>{
			return [webgazer.params.videoViewerWidth,webgazer.params.videoViewerHeight]
		})
		const new_dimensions = [video_dimensions[0],video_dimensions[1]]
		const new_video_dimensions = await page.evaluate(async(new_dimensions)=>{
			await webgazer.setVideoViewerSize(new_dimensions[0],new_dimensions[1])
			return [webgazer.params.videoViewerWidth,webgazer.params.videoViewerHeight] 
		},new_dimensions)
		assert.equal(new_video_dimensions[0],new_dimensions[0])
		assert.equal(new_video_dimensions[1],new_dimensions[1])
	})
	it('top level, non-video no arguments webgazer functions should work', async() =>{
		let time = startTimer()
		let basic_functions = await page.evaluate(async() => {		
			return {getCurrentPrediction: JSON.stringify(await webgazer.getCurrentPrediction()),
					addMouseEventListeners: JSON.stringify(await webgazer.addMouseEventListeners()),
					getStoredPoints:JSON.stringify(await webgazer.getStoredPoints()),
					removeMouseEventListeners:JSON.stringify(await webgazer.removeMouseEventListeners()),
					isReady:JSON.stringify(await webgazer.isReady()),
					detectCompatibility:JSON.stringify(await webgazer.detectCompatibility()),
					clearGazeListener:JSON.stringify(await webgazer.clearGazeListener()),
					getRegression:JSON.stringify(await webgazer.getRegression()),
					getStoredPoints:JSON.stringify(await webgazer.getStoredPoints()),
					pause:JSON.stringify(await webgazer.pause())
				}
			})
	console.log("took ",endTimer(time)," milliseconds")


	for(const [k,v] of Object.entries(basic_functions)){ 
			assert.notEqual(Object.keys(v),null)
			assert.notEqual(Object.keys(v),{})
			}

	assert.equal(basic_functions.isReady,"true")
	assert.equal(basic_functions.detectCompatibility,"true")
	})

	it('can record screen position, set tracker and regression and set static video', async() =>{
		const screen_functions = page.evaluate(async() => {
			return {setStaticVideo: await webgazer.setStaticVideo('../www/data/src/P_02/1491487691210_2_-study-dot_test_instructions.webm'),
					setTracker: await webgazer.setTracker('TFFacemesh'), 
					setRegression: await webgazer.setRegression('ridge')}
		})
		for(const [k,v] of Object.entries(screen_functions)){ 
			assert.notEqual(Object.keys(v),null)
			assert.notEqual(Object.keys(v),{})
	  	}
	})
	//checkEyesInValidationBox exists in code but the comment above says it's wrong and it returns nothing
})