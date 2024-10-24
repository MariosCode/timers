
/**  
 * @class TimerDisplay
 * @classdesc The superclass for all TimerDisplay subclasses. This class exists solely for type checking purposes.
 */
export class TimerDisplay{
    constructor(){
        
    }

    /**
     * Takes a time in milliseconds since unix epoch as a number and a format as a string.
     * 
     * Validates the format and returns null if invalid or the formatted time as a string otherwise.
     * 
     * Can also take durations in milliseconds, if third parameter is true.
     *   
     * @param {Number} milliseconds - The args object created from the element with the "settings" class
     * @param {String} format - List created from all li elements in a ul or ol element
     * @returns {String|null} - Returns an instance of RotateTimer if the parameters are valid, otherwise returns null
     */
    static formatTime(milliseconds, format, isDuration = false){

    }
}