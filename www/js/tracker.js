import {isInside,getMousePos,get_distance,onload,initial_dimensions,destination_dimensions,beep,checkTime} from './helpers.js';
//import {h337} from '../node_modules/heatmap.js/build/heatmap.js'


window.applyKalmanFilter = true;

window.saveDataAcrossSessions = true;

const collisionSVG = "collisionSVG";

let blinks = 0;
//var blink_detector = new webgazer.BlinkDetector();
var color_sum_open = 0;
var color_sum_closed = 0;
var color_sum_open = 0;
var calibrate_blink_open = true;
var calibrate_blink_closed = true;
var blinking = false;
var time_initial = 0;
var last_position = null;
var config = {
  container: document.getElementById('heatmap'),
  radius: 10,
  maxOpacity: .5,
  minOpacity: 0,
  blur: .75
};
var heatmap = h337.create(config)
var heatmap_data = []



var open_left_eye_dist, closed_left_eye_dist,
    ctxl = document.getElementById('eye_image_left').getContext("2d"),
    ctxr = document.getElementById('eye_image_right').getContext("2d");

var EyeListener = async function(data, clock) {
  if(!data)
    return;
  if (!webgazerCanvas) {
    webgazerCanvas = webgazer.getVideoElementCanvas();
  }
  var patches = await webgazer.getTracker().getEyePatches(webgazerCanvas, webgazerCanvas.width, webgazerCanvas.height);
  //this is obviously biased by lighting
  var eye_color_sum = patches.right.patch.data.reduce((a, b) => a + b, 0);
  //other potential way of getting blink - compare distance between top and bottom of eye
  var fmPositions = await webgazer.getTracker().getPositions();
  //user has 1.5 seconds to close eyes, then at beep they should open them.
  if (!calibrate_blink_closed){
  	calibrate_blink_closed = true;
    await new Promise(r => setTimeout(r, 1500));
    document.getElementById('closed_downloadphoto').href = document.getElementById('webgazerVideoCanvas').toDataURL('image/png');
    closed_left_eye_dist = patches.left.height
    color_sum_closed = eye_color_sum;
    document.getElementById('eye_tracking_data').innerHTML += "color_sum_closed " + String(color_sum_closed) +'<br>';
    beep();
    await new Promise(r => setTimeout(r, 3000))
    calibrate_blink_open = false;
    return
  }
  else if (!calibrate_blink_open){
    //TO-DO add error detection if color_sums aren't significantly different - figure out how to
    //prevent this from being called multiple times
    color_sum_open = eye_color_sum
    document.getElementById('open_downloadphoto').href = document.getElementById('webgazerVideoCanvas').toDataURL('image/png');
    open_left_eye_dist = patches.left.height
    
    document.getElementById('eye_tracking_data').innerHTML += "color_eye_open " + String(color_sum_open) + '<br>';
    await new Promise(r => setTimeout(r, 3000));
    calibrate_blink_open = true;
  }
  if (eye_color_sum - color_sum_open < color_sum_closed - eye_color_sum){
    if (!blinking){
      blinking = true;
      blinks++;
      console.log("eye distance =" + patches.left.height);
    }
  }
  else{
    blinking = false;
  }
  // if (composing_eyes){
  // 	//check for time, set composing_eyes to false if past time
  // 	//create two dimensional array for each eye containing average
  // 	//tricky part is eyes can be of different sizes
  // 	//so could try to shrink or expand eyes (tricky) - use webgazer.util.resizeEye
  //could modify to increase size of eye so we don't lose information - also try and just
  //extract the center of the eye, currently we select a rectangle which include other features

  // }
  //ctxl.putImageData(patches.left.patch,0,0)
  ctxl.putImageData(webgazer.util.resizeEye(patches.right,150,90),0,0)
  patches.left.patch = new ImageData(new Uint8ClampedArray(webgazer.util.diamondEyes(patches.left.patch))
    ,patches.left.width,patches.left.height)
  ctxr.putImageData(webgazer.util.resizeEye(patches.left,150,90),0,0)


  
  
  if (time_initial == 0){
  	time_initial = clock;
  }
  if (!last_position){
  	last_position = (({ x, y }) => ({ x, y }))(data)
  	return
	}  

  var distance_traveled = get_distance(last_position.x,data.x,last_position.y,data.y)
  total_distance += distance_traveled
  last_position = (({ x, y }) => ({ x, y }))(data)
  if(clock - time_initial > 60000){
  	var today = new Date();
  	document.getElementById('eye_tracking_data').innerHTML += checkTime(today.getHours()) + ":" + checkTime(today.getMinutes())
  	document.getElementById('eye_tracking_data').innerHTML += " minute blinks is "+ String(blinks) + 
  		" distance is " + String(Math.round(total_distance)) + "<br>";
  	blinks = 0;
  	total_distance = 0;
  	time_initial = 0;
  	console.log('minute passed')
  }
  var datum = {x:data.x,y:data.y,value:1}
  for(let i=0;i<heatmap_data.length;i++){
  	if(heatmap_data.x==datum.x && heatmap_data==datum.y){
  		datum.value = heatmap_data.value+1;
  		console.log("found match at ")
  		console.log(datum)
  	}
  }
  heatmap_data.push(datum)
  heatmap.addData(datum)
}

function setup(){
  var width = window.innerWidth;
  var height = window.innerHeight;

  var svg = d3.select("body").append("svg")
  .attr("id", collisionSVG)
  .attr("width", width)
  .attr("height", height)
  .style("top", "0px")
  .style("left","0px")
  .style("margin","0px")
  .style("position","absolute")
  .style("z-index", 100000);

  
}

var textFile = null;

function makeTextFile(text) {
    var data = new Blob([text], {type: 'text/plain'});
    if (textFile !== null) {
      window.URL.revokeObjectURL(textFile);
    }

    textFile = window.URL.createObjectURL(data);

    return textFile;
  };

window.onload = onload(setup(),EyeListener)

window.onbeforeunload = function() {
  if (window.saveDataAcrossSessions) {
      webgazer.end();
  } else {
      localforage.clear();
  }
}

var webgazerCanvas = null;
var total_distance = 0;

var canvas = document.getElementById('collisionSVG');
var calibrate_blink_button = document.getElementById('calibrate_blink_button');
var create = document.getElementById('create');
var heat_map = document.getElementById('see_heatmap');
var calibrate_button = document.getElementById('calibrate_button');
var calibrate_button_attrs = calibrate_button.getBoundingClientRect()
var calibrate_button_rect = {
  x:calibrate_button_attrs.x,
  y:calibrate_button_attrs.y,
  width:calibrate_button_attrs.width,
  height:calibrate_button_attrs.height
}

var button_blink_attrs = calibrate_blink_button.getBoundingClientRect()
var button_blink_rect = {
  x:button_blink_attrs.x,
  y:button_blink_attrs.y,
  width:button_blink_attrs.width,
  height:button_blink_attrs.height
}
var button_download_attrs = create.getBoundingClientRect()
var button_download_rect = {
  x:button_download_attrs.x,
  y:button_download_attrs.y,
  width:button_download_attrs.width,
  height:button_download_attrs.height
}

var button_heatmap_attrs = heat_map.getBoundingClientRect()
var button_heatmap_rect = {
  x:button_heatmap_attrs.x,
  y:button_heatmap_attrs.y,
  width:button_heatmap_attrs.width,
  height:button_heatmap_attrs.height
}


canvas.addEventListener('click',function(evt){
  var mousePos = getMousePos(canvas, evt);
  if (isInside(mousePos,button_blink_rect)){
    calibrate_blink_closed = false;
    
  }
  else if (isInside(mousePos,calibrate_button_rect)){
  	webgazer.removeMouseEventListeners()
  }
  //can display message to user about how long to close eyes
  else if (isInside(mousePos,button_download_rect)){
  	var link = document.getElementById('downloadlink');
  	var eye_tracking_data_text = eye_tracking_data.innerHTML
  	eye_tracking_data_text = eye_tracking_data_text.replace(/<br>/g,"\n")
    link.href = makeTextFile(eye_tracking_data_text);
    document.getElementById('downloadlink').click()
  }
  else if (isInside(mousePos,button_heatmap_rect)){
  	var see_heatmap = document.getElementById('heatmap');
  	see_heatmap.style.visibility = 'visible';
	domtoimage.toPng(document.body)
    .then(function (dataUrl) {
        document.getElementById('closed_downloadphoto').href = dataUrl;
    })
    .catch(function (error) {
        console.error('oops, something went wrong!', error);
    });

  }
})

