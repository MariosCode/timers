export function argumentError(warning) {
	console.warn("Argument Error: " + warning);
}

export function parseSettings(input) { 
    const args = {}; 
    const regex = /(\w+)=(({.*?})+|[^ ]+)/g; 
    let match; 

    while ((match = regex.exec(input)) !== null) { 
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