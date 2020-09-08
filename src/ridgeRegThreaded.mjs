import util from './util';
import numeric from 'numeric';
import util_regression from './util_regression';

const reg = {};

var weights = {'X':[0],'Y':[0]};


/**
 * Constructor of RidgeRegThreaded object,
 * it retrieve data window, and prepare a worker,
 * this object allow to perform threaded ridge regression
 * @constructor
 */
reg.RidgeRegThreaded = function() {
    this.init();
};

/**
 * Initialize new arrays and initialize Kalman filter.
 */
reg.RidgeRegThreaded.prototype.init = util.InitRegression

/**
 * Add given data from eyes
 * @param {Object} eyes - eyes where extract data to add
 * @param {Object} screenPos - The current screen point
 * @param {Object} type - The type of performed action
 */
reg.RidgeRegThreaded.prototype.addData = function(eyes, screenPos, type) {
    if (!eyes) {
        return;
    }
    //not doing anything with blink at present
    // if (eyes.left.blink || eyes.right.blink) {
    //     return;
    // }
    this.worker.postMessage({'eyes':util.getEyeFeats(eyes), 'screenPos':screenPos, 'type':type});
};

/**
 * Try to predict coordinates from pupil data
 * after apply linear regression on data set
 * @param {Object} eyesObj - The current user eyes object
 * @returns {Object}
 */
reg.RidgeRegThreaded.prototype.predict = function(eyesObj) {
    // console.log('LOGGING..');
    if (!eyesObj) {
        return null;
    }
    var coefficientsX = weights.X;
    var coefficientsY = weights.Y;

    var eyeFeats = util.getEyeFeats(eyesObj);
    var predictedX = 0, predictedY = 0;
    for(var i=0; i< eyeFeats.length; i++){
        predictedX += eyeFeats[i] * coefficientsX[i];
        predictedY += eyeFeats[i] * coefficientsY[i];
    }

    predictedX = Math.floor(predictedX);
    predictedY = Math.floor(predictedY);

    if (window.applyKalmanFilter) {
        // Update Kalman model, and get prediction
        var newGaze = [predictedX, predictedY]; // [20200607 xk] Should we use a 1x4 vector?
        newGaze = this.kalman.update(newGaze);

        return {
            x: newGaze[0],
            y: newGaze[1]
        };
    } else {
        return {
            x: predictedX,
            y: predictedY
        };
    }
};

/**
 * Add given data to current data set then,
 * replace current data member with given data
 * @param {Array.<Object>} data - The data to set
 */
reg.RidgeRegThreaded.prototype.setData = util_regression.setData

/**
 * Return the data
 * @returns {Array.<Object>|*}
 */
reg.RidgeRegThreaded.prototype.getData = function() {
    return this.dataClicks.data;
};

/**
 * The RidgeRegThreaded object name
 * @type {string}
 */
reg.RidgeRegThreaded.prototype.name = 'ridge';

export default reg;
