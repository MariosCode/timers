
/**  
 * @class TimerDisplay
 * @classdesc The superclass for all TimerDisplay subclasses.
 */
export class TimerDisplay{
    constructor(){
        
    }

    /**
     * If isDuration is false or missing, takes a time in milliseconds since unix epoch as a number. Validates the format and returns the time of day as a string, or null if invalid.
     * 
     * hideLeading0 and hideAll0 are ignored.
     * 
     * 
     * Valid formats:
     * 
     * - h:mm:ss.sssS or h:mm:ss.sssZ or h:mm:ssE 
     * - h for hour, m for minute, s for second, .s for milliseconds. If 2 h are used instead of 1, the hour will be 2 digits (padded with a 0).
     * - milliseconds and seconds are optional.
     * - S for time in server's timezone, Z for local time, E for Erinn time. If not specified, server time is used.
     * - W can be added before the last letter to use a 12 hour clock with a space and AM/PM afterwards.
     * 
     * If isDuration is true, takes milliseconds as a number. Validates the format and returns the duration of time as a string, or null if invalid.
     * 
     * hideLeading0 will hide the 0 values at the beginning of the string. For example "0:0:40:0" would instead be "40:0".
     * 
     * hideAll0 will hide all 0 values throughout the string. For example "0 days, 40 hours, 0 minutes, 10 seconds" would instead be "40 hours, 10 seconds".
     * 
     * Valid formats:
     * 
     * - d:h:m:s.sS or d:h:m:s.sZ or d:h:m:sE
     * - All letters are optional.
     * - Multiple letters can be used to pad with 0s.
     * - S and Z are identical here and return realtime. E returns Erinn time. If not specified, real time is used.
     * - W can be added before the last letter to use english words. Example: d:h:m:sWS with hideAll0 could be "12 days, 5 hours, 59 seconds".
     * 
     * @param {Number} milliseconds - Either milliseconds since unix epoch or milliseconds duration
     * @param {String} format - Format to turn the milliseconds into
     * @param {Boolean} isDuration - Format the milliseconds given as a duration of time instead of a time on the clock
     * @param {Boolean} hideLeading0 - Hide the 0 values at the beginning of the string
     * @param {Boolean} hideAll0 - Hide all 0 values throughout the string
     * @returns {String} - Returns the formatted time as a string
     */
    static formatTime(milliseconds, format, isDuration = false, hideLeading0 = false, hideAll0 = false){
        // Validate parameters
        if(!Number.isInteger(milliseconds)) timerDisplayError(`formatTime is Unable to format milliseconds "${milliseconds}" due to not passing the Number.isInteger() check`);
    }

    static #formatTimeClock(){

    }

    static #formatTimeDuration(){

    }
}