if (typeof AFRAME === 'undefined') {
    throw new Error('Component attempted to register before AFRAME was available.');
}


//////////
// GLOBALS

// Times
export var MAX_TIME_UNIT = 100
export var MIN_TIME_UNIT = 1
export var INITIAL_TIME_UNIT = 50

var TIME_UNIT = INITIAL_TIME_UNIT // This is the only variable you must modify to alter the speed of the whole animation
export function setTIME_UNIT(v){
    TIME_UNIT = v    
}
export function getTIME_UNIT(){
    return TIME_UNIT
}

var FAST_FORWARD_MODE = false
export function setFastForwardMode(v) { FAST_FORWARD_MODE = v }
export function isFastForwardMode() { return FAST_FORWARD_MODE }

export var DURATION_LINK = 20 * TIME_UNIT

export var TICK = 10 * TIME_UNIT // 
var DURATION = TICK / 5 //10
