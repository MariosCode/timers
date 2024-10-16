
/**
 * Handles invalid arguments in timers. Prints
 * 
 * "Argument Error: " + warning
 * 
 * to the console.
 * 
 * @param {String} warning - string describing the issue
 */
export function argumentError(warning) {
	console.warn(`Argument Error: ${warning}`);
}

/**
 * 
 * @param {String} input - string containing the settings to parse.
 * 
 * for example:
 * 
 * "key=value key2={value with a space} key3={multiple values1}{multple values2} type=rotate epoch=2016-01-31T00:00:00S change-every=24:00:00 label={Today is} labelLink=https://wiki.mabi.world/ display=status"
 * 
 * valid keys are anything with letters and numbers only.
 * valid values are anything without spaces. Use curly brackets to be able to use spaces in values.
 * Multiple groups of touching curly brackets allow you to have multiple values assigned to a key.
 * 
 * @returns {Object} - returns an object filled with arrays
 */
export function parseSettings(input) {
    const args = {};
    // this regex takes all the key=value pairs from the settings, ignoring anything that doesn't match the pattern described above.
    const regex = /(\w+)=(({.*?})+|[^ ]+)/g;
    let match;

    while ((match = regex.exec(input)) !== null) {
        // match[0] is the whole key=value pair, match[1] is just the key, match[2] is all the values, match[3] is the last value
        const key = match[1];
        let value = match[2];

        // Check if the value starts with a '{', indicating it could be multiple values
        if (value.startsWith('{')) {
            const values = [];
            // Extract all the curly bracketed values
            let curlyRegex = /{(.*?)}/g;
            let curlyMatch;
            while ((curlyMatch = curlyRegex.exec(value)) !== null) {
                values.push(curlyMatch[1]);
            }

            // If we found curly-bracketed values, set them as array
            if (values.length > 0) {
                args[key] = values;
            } else {
                // Otherwise, treat it as a single value
                args[key] = [value];
            }
        } else {
            // Regular key=value pairs without curly braces
            args[key] = [value];
        }
    }

    return args;
}