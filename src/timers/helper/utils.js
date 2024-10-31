/**
 * The time since unix epoch that the page loaded. Used with the timestamp from requestAnimationFrame to keep timer displays in sync.
 * @type {Number}
 */
export const TIME_PAGE_LOAD = Math.floor(Date.now() - performance.now());

/**
 * Server timezone for use with {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat|Intl.DateTimeFormat}
 */
export const SERVER_TIMEZONE = 'America/Los_Angeles';

/**
 * In milliseconds
 * @type {Number}
 */
export const TIME_PER_ERINN_MINUTE = 1500;
/**
 * In milliseconds
 * @type {Number}
 */
export const TIME_PER_ERINN_HOUR = TIME_PER_ERINN_MINUTE*60;
/**
 * In milliseconds
 * @type {Number}
 */
export const TIME_PER_ERINN_DAY = TIME_PER_ERINN_HOUR*24;
/**
 * In milliseconds
 * @type {Number}
 */
export const ERINN_TIME_OFFSET = TIME_PER_ERINN_HOUR*8;


/**
 * Handles invalid arguments in timers. Prints
 * 
 * 'Argument Error: ' + warning
 * 
 * to the console.
 * 
 * @param {String} warning - String describing the issue
 * @param extraArgs - Additional data to be logged to console
 */
export function argumentError(warning, ...extraArgs) {
	console.warn(`Argument Error: ${warning}`, ...extraArgs);
    return null;
}


/**
 * Handles general unexpected errors in timers. Prints
 * 
 * 'Timer Error: ' + warning
 * 
 * to the console.
 * 
 * @param {String} warning - String describing the issue
 * @param extraArgs - Additional data to be logged to console
 */
export function timerError(warning, ...extraArgs) {
	console.warn(`Timer Error: ${warning}`, ...extraArgs);
    return null;
}


/**
 * Handles general unexpected errors in timer displays. Prints
 * 
 * 'Timer Display Error: ' + warning
 * 
 * to the console.
 * 
 * @param {String} warning - String describing the issue
 * @param extraArgs - Additional data to be logged to console
 */
export function timerDisplayError(warning, ...extraArgs) {
	console.warn(`Timer Display Error: ${warning}`, ...extraArgs);
    return null;
}


/**
 * Handles errors in settings validation in timer displays. Prints
 * 
 * 'Timer Display Creation Error: ' + warning
 * 
 * to the console.
 * 
 * @param {String} warning - String describing the issue
 * @param extraArgs - Additional data to be logged to console
 */
export function timerDisplayCreationError(warning, ...extraArgs) {
	console.warn(`Timer Display Creation Error: ${warning}`, ...extraArgs);
    return null;
}

/**
 * Turns settings from HTML into an object of arrays of strings.
 * 
 * @param {String} input - String containing the settings to parse.
 * 
 * For example:
 * 
 * "key=value key2={value with a space} key3={multiple values1}{multple values2} type=rotate epoch=2016-01-31T00:00:00S changeEvery=24:00:00S"
 * 
 * Valid keys are anything with letters and numbers only.
 * 
 * Valid values are anything without spaces. Use curly brackets to be able to use spaces in values.
 * 
 * Multiple groups of touching curly brackets allow you to have multiple values assigned to a key.
 * 
 * @returns {Object} - Returns an object filled with arrays of strings.
 */
export function parseSettings(input) {
    const args = {};
    // This regex takes all the key=value pairs from the settings, ignoring anything that doesn't match the pattern described above.
    const regex = /(\w+)=(({.*?})+|[^ ]+)/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
        // match[0] is the whole key=value pair, match[1] is just the key, match[2] is all the values, match[3] is the last value.
        const key = match[1];
        let value = match[2];

        // Add the key to args if it doesn't already exist
        if(!(key in args)){
            args[key] = [];
        }

        // Check if the value starts with a '{', indicating it could be multiple values
        if (value.startsWith('{')) {
            const values = [];
            // Extract all the curly bracketed values
            let curlyRegex = /{(.*?)}/g;
            let curlyMatch;
            while ((curlyMatch = curlyRegex.exec(value)) !== null) {
                values.push(curlyMatch[1]);
            }

            // If we found a completely enclosed curly-bracketed value/values, add them to the array without the brackets
            if (values.length > 0) {
                args[key] = [...args[key], ...values];
            } else {
                // Otherwise, add this to the array as is
                args[key].push(value);
            }
        } else {
            // Regular key=value pairs without curly brackets
            args[key].push(value);
        }
    }

    return args;
}

/**
 * Checks if the given string is a valid server date time string, formatted as
 * 
 * yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mm:ss.sssS for milliseconds, or yyyy-mm-ddThh:mmS
 * 
 * Numbers besides year can be single digit. The T and S can be lowercase.
 * 
 * @param {String} input 
 * @returns
 * - Returns an object with the date and time from the string separated as individual numbers, and a Date (adjusted for time zone). 
 * - Note the numbers in the returned object are just the numbers from the input not adjusted in any way.
 */
export function parseServerDateTime(input){
    // Regular expression to match the formats yyyy-mm-ddThh:mm:ssS or yyyy-mm-ddThh:mm:ss.sssS for milliseconds, or yyyy-mm-ddThh:mmS. Numbers besides year can be single digit. The T and S can be lowercase.
    const regex = /^(\d{4})-(\d{1,2})-(\d{1,2})[Tt](\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,3}))?)?[Ss]$/;

    // Test if the input matches the allowed formats
    const match = input.match(regex);
    if (!match) {
        return false;
    }

    // Extract the parts of the date from the input
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = match[6] ? parseInt(match[6], 10) : 0;
    const millisecond = match[7] ? parseInt(match[7], 10) : 0;

    // Validate the month (must be between 1 and 12)
    if (month < 1 || month > 12) {
        return false;
    }

    // Validate the day based on the month and if the year is a leap year
    const daysInMonth = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > daysInMonth[month - 1]) {
        return false;
    }

    // Validate the hour, minute, second, millisecond
    if (hour < 0 || hour > 23  ||  minute < 0 || minute > 59  ||  second < 0 || second > 59  ||  millisecond < 0 || millisecond > 999) {
        return false;
    }

    // The date has been fully validated. Now turn this date from the server's timezone into miliseconds.
    // Create a string that can be used to make a Date object from the server's time zone
    const dateTimeStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.${String(millisecond).padStart(3, '0')}`;

    // Make a Date object from the server's time zone
    const dateObject = new Date(new Intl.DateTimeFormat('en-US', {
        timeZone: SERVER_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
        hour12: false
    }).format(new Date(dateTimeStr)));

    // Milliseconds can now be gotten with dateObject.getTime();
    // Note that the numbers for year, month, day, etc. in the following returned object are taken from the input string. Use dateObject to get date and time for the user's timezone.

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        dateObject
    };
}

/**
 * Check if a year is a leap year
 * 
 * @param {Number} year
 * @returns {Boolean}
 */
export function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Validates an array of strings that should be formatted as hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, or hh:mmE with S and E being the actual letters.
 * 
 * These are validated as durations, not times. So each number can be any number of digits long.
 * 
 * Returns true if the strings are all valid, false if any one of them isn't.
 * 
 * Note: Durations can be 0. 0:0S is valid.
 * 
 * @param {String[]} times
 * @returns {Boolean}
 */
export function validateDurationTimeStrings(times){
    const regex = /^(?:\d+:\d+S|\d+:\d+:\d+S|\d+:\d+:\d+\.\d+S|\d+:\d+E)$/i;
    return times.every(str => regex.test(str));
}

/**
 * Validates an array of strings that should be formatted as hh:mm:ss.sssS, hh:mm:ssS, hh:mmS, or hh:mmE with S and E being the actual letters.
 * 
 * These are validated as times, not durations. Each number can be 1 or 2 digits long, or up to 3 for milliseconds, but must be a valid time.
 * 
 * Returns true if the strings are all valid, false if any one of them isn't.
 * 
 * @param {String[]} times
 * @returns {Boolean}
 */
export function validateTimeStrings(times){
    // The number of digits matter, since this is a time not a duration
    const regex = /^(?:\d{1,2}:\d{1,2}S|\d{1,2}:\d{1,2}:\d{1,2}S|\d{1,2}:\d{1,2}:\d{1,2}\.\d{1,3}S|\d{1,2}:\d{1,2}E)$/i;
    return times.every(str => {
        const match = str.match(regex);
        if (!match) {
            return false;
        }
        // Found a match. Remove the letter at the end, split at colons or periods, and turn into numbers.
        let trimmedTimeString = match[0].slice(0, -1).split(/[:\.]/).map(Number);
        // Take the number or use 0
        let hours = trimmedTimeString[0] | 0;
        let minutes = trimmedTimeString[1] | 0;
        let seconds = trimmedTimeString[2] | 0;
        let milliseconds = trimmedTimeString[3] | 0;

        // Validate the hour, minute, second, millisecond
        if (hours < 0 || hours > 23  ||  minutes < 0 || minutes > 59  ||  seconds < 0 || seconds > 59  ||  milliseconds < 0 || milliseconds > 999) {
            return false;
        }

        return true;
    });
}

/**
 * Takes and validates a Server or Erinn time string or duration and returns the number of milliseconds as a number.
 * 
 * Returns false if time string provided was not a valid time string or duration.
 * 
 * @param {String} timeString - The time string to convert
 * @param {Boolean} fromMidnight - Optionally, if this is true then full days will be removed from the string (to give milliseconds from midnight, assuming duration 0:0 was a midnight)
 * @returns - Number of milliseconds as a number
 */
export function convertTimeStringToRealMilliseconds(timeString, fromMidnight){
    // If the time string given was invalid , return false.
    if(!validateDurationTimeStrings([timeString])) return false;

    // Erinn time string
    if(timeString.slice(-1).toUpperCase() === 'E'){
        // Extract the hours and minutes
        // Remove the E, split by colons, and then convert to numbers
        const [hours, minutes] = timeString.slice(0, -1).split(':').map(Number);

        let totalErinnMinutes = (hours * 60) + minutes;
        if(fromMidnight){
            // Remove full days
            totalErinnMinutes = totalErinnMinutes%1440;
        }

        // Convert Erinn minutes to real milliseconds and return.
        return totalErinnMinutes * TIME_PER_ERINN_MINUTE;
    // Server time string
    }else{
        // Valid formats: hh:mmS, hh:mm:ssS, hh:mm:ss.sssS
        // Trim off the S, split it up by the colons or periods, and convert to numbers
        let trimmedTimeString = timeString.slice(0, -1).split(/[:\.]/).map(Number);

        // This is already in real time, but duration time strings don't have a limit to their digits. It's possible the time string was something like 1:1:99999S.
        // Add a 0 when a number is missing.
        let hours = trimmedTimeString[0] | 0;
        let minutes = trimmedTimeString[1] | 0;
        let seconds = trimmedTimeString[2] | 0;
        let milliseconds = trimmedTimeString[3] | 0;

        // Calculate the total milliseconds
        let totalMilliseconds = (hours*3600000) + (minutes*60000) + (seconds*1000) + milliseconds;

        if(fromMidnight){
            // Remove full days
            totalMilliseconds = totalMilliseconds%86400000;
        }
        return totalMilliseconds;
    }
}

/**
 * Takes and validates a duration time string (including Erinn time strings) and converts it to a full server duration time string and milliseconds.
 * 
 * This will also take a shortened server time string like 1:2s and turn it into a full time string like 01:02:00.000S
 * 
 * This assumes the time string given is a duration of time, not a point in time.
 * 
 * Note: All the numbers will be 2 digits and milliseconds 3 digits, but this is a duration time string and not an actual time so hours can be more than 2 digits.
 * 
 * @param {String} timeString - The time string to convert. Can be in any valid time string format.
 * @returns - Returns an object with the full duration in milliseconds and the time string in hh:mm:ss.sssS format, meant to be used as a duration of time. Returns false if the time string given was invalid.
 */
export function convertTimeStringToFullServerDurationTimeString(timeString){
    // If the time string given was invalid or wasn't an Erinn time string, return false.
    if(!validateDurationTimeStrings([timeString])) return false;

    // Prepare variables that will be used in the final return object
    let realHours = 0;
    let realMinutes = 0;
    let realSeconds = 0;
    let realMilliseconds = 0;
    let totalRealMilliseconds = 0;

    // First handle Erinn time strings
    if(timeString.slice(-1).toUpperCase() === 'E'){
        // Convert Erinn minutes to real milliseconds
        totalRealMilliseconds = convertTimeStringToRealMilliseconds(timeString);

        // Convert real seconds to real hours, minutes, and seconds
        realHours = Math.floor(totalRealMilliseconds / 3600000); // 3600000 milliseconds in an hour
        realMinutes = Math.floor((totalRealMilliseconds % 3600000) / 60000); // Leftover after dividing by hours, divided by milliseconds in a minute
        realSeconds = Math.floor((totalRealMilliseconds % 60000) / 1000); // Leftover after dividing by minutes, divided by milliseconds in a second
        realMilliseconds = Math.floor(totalRealMilliseconds % 1000); // Leftover milliseconds after dividing by seconds
    // Now handle server time strings
    }else{
        // Calculate the total milliseconds
        totalRealMilliseconds = convertTimeStringToRealMilliseconds(timeString);
        // Calculate the other times
        realHours = Math.floor(totalRealMilliseconds / 3600000); // 3600000 milliseconds in an hour
        realMinutes = Math.floor((totalRealMilliseconds % 3600000) / 60000); // Leftover after dividing by hours, divided by milliseconds in a minute
        realSeconds = Math.floor((totalRealMilliseconds % 60000) / 1000); // Leftover after dividing by minutes, divided by milliseconds in a second
        realMilliseconds = Math.floor(totalRealMilliseconds % 1000); // Leftover milliseconds after dividing by seconds
    }

    // Format the result as `hh:mm:ss.sssS`. There will be 2 digits for each number, 3 for milliseconds, but as a duration time string it is possible for hours to have more than 2 digits.
    let fullTimeString = `${String(realHours).padStart(2, '0')}:${String(realMinutes).padStart(2, '0')}:${String(realSeconds).padStart(2, '0')}.${String(realMilliseconds).padStart(3, '0')}S`;
    return{
        timestring: fullTimeString,
        milliseconds: totalRealMilliseconds
    }
}

/**
 * Takes and validates a time string (including Erinn time strings) and converts it to milliseconds after midnight.
 * 
 * This assumes the time string given is a point in time. If a duration is given, full days will be removed (assumes duration of 0 was midnight)
 * 
 * For Erinn time strings, this will give real time milliseconds after Erinn midnight that the time occurs.
 * 
 * For Server time strings, this will give milliseconds after server midnight that the time occurs.
 * 
 * @param {String} timeString - The time string to convert. Can be in any valid time string format.
 * @returns - Returns an object with the milliseconds after midnight that the time given occurred and a type that is either Erinn or Server. Returns false if the time string given was invalid.
 */
export function convertTimeStringToMillisecondsAfterMidnight(timeString){
    // If the time string given was invalid return false.
    if(!validateDurationTimeStrings([timeString])) return false;

    // Prepare variables that will be used in the final return object
    let type = (timeString.slice(-1).toUpperCase() === 'E' ? 'Erinn' : 'Server');
    let totalRealMilliseconds = 0;

    // Handle Erinn time strings
    if(type === 'Erinn'){
        // Convert Erinn time string to real milliseconds, use optional parameter to remove full days from time string
        totalRealMilliseconds = convertTimeStringToRealMilliseconds(timeString, true);
    // Handle Server time strings
    }else{
        // Convert Server time string to real milliseconds, use optional parameter to remove full days from time string
        totalRealMilliseconds = convertTimeStringToRealMilliseconds(timeString, true);
    }

    return {
        type,
        milliseconds: totalRealMilliseconds
    }
}

/**
 * Takes and validates a time string and returns an Erinn time string.
 * 
 * The time string given can be a time or a duration. Either way, assuming the 0 value was also 00:00E, this function will return the time in the Erinn day.
 * 
 * @param {String} timeString - The Server time string to convert
 * @returns - Returns the equivalent full Erinn time string as a string, rounded down (1499 miliseconds turns into 0 Erinn minutes). For example '00:01E'.
 * This is a time, not a duration. If the time string/duration time string given was multiple Erinn days long, this will return the time in the last Erinn day.
 */
export function convertToErinnTimeString(timeString){
    // If the time string given was invalid return false.
    if(!validateDurationTimeStrings([timeString])) return false;

    // If this is already an Erinn time string, remove full Erin days from it and pad it if necessary so each group of numbers is 2 digits then return it.
    if(timeString.slice(-1).toUpperCase() === 'E'){
        let [hours, minutes] = timeString.slice(0, -1).split(':');
        let totalErinnMinutes = (hours * 60) + minutes;
        // Remove full days
        totalErinnMinutes = totalErinnMinutes%1440;
        // Set final hours and minutes
        hours = Math.floor(totalErinnMinutes/60);
        minutes = totalErinnMinutes%60;
        // Return the new string, padded so each group of numbers is 2 digits
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}E`;
    // Server time string
    }else{
        // Get total milliseconds and remove full Erinn days
        let milliseconds = convertTimeStringToRealMilliseconds(timeString) % TIME_PER_ERINN_DAY;
        // Convert to total Erinn minutes, rounded down
        let totalErinnMinutes = Math.floor(milliseconds/TIME_PER_ERINN_MINUTE);
        // Set final hours and minutes
        let hours = Math.floor(totalErinnMinutes/60);
        let minutes = totalErinnMinutes%60;
        // Return the new string, padded so each group of numbers is 2 digits
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}E`;
    }
}

/**
 * Takes a Date object and returns the milliseconds after the server timezone's midnight for that Date.
 * @param {Date} date 
 * @returns {Number}
 */
export function dateToMillisecondsAfterServerMidnight(date){
    // Create the formatter in the server's timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: SERVER_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3,
        hour12: false
    });

    // Get the parts of the date
    const parts = formatter.formatToParts(date);

    // Extract the parts we need
    const hour = parseInt(parts.find(p => p.type === 'hour').value);
    const minute = parseInt(parts.find(p => p.type === 'minute').value);
    const second = parseInt(parts.find(p => p.type === 'second').value);
    const millisecond = parseInt(parts.find(p => p.type === 'fractionalSecond').value);

    return hour*3600000 + minute*60000 + second*1000 + millisecond;
}

/**
 * Works identically to Array.find(), except it finds the last match instead of the first. More efficient than copying the array and reversing it.
 * 
 * @param {Array} arr - The array to perform the search on
 * @param {Function} condition - The function that must return true for the value to be returned.
 * @returns - Returns the last value in the provided array that returns true with the provided condition function. Returns undefined if no match was found.
 */
export function arrayFindLast(arr, condition){
    for(let i = arr.length - 1; i >= 0; i--){
        if(condition(arr[i])) return arr[i];
    }
    return undefined;
}

/**
 * Helper function to sanitize the CSS styles
 * @param {String} str - String to turn into camel case
 * @returns {String}
 */
export function camelCase(str){
    return str.replace(/-([a-z])/gi, function(match, letter){
        return letter.toUpperCase();
    });
}