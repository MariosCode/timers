
/**  
 * @class TimerDisplay
 * @classdesc The superclass for all TimerDisplay subclasses.
 */
export class TimerDisplay{
    // Prevent the use of the constructor so this class can only be created with TimerDisplay.createInstance
    static _allowConstructor = false;
    
    constructor(){
        if(!TimerDisplay._allowConstructor) return timerError(`TimerDisplay must be instantiated with TimerDisplay.createInstance() instead of new TimerDisplay()`);
        TimerDisplay._allowConstructor = false;
    }

    static createInstance(){
        TimerDisplay._allowConstructor = true;
        return new TimerDisplay();
    }
}