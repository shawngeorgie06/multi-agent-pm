const code = '<div class="app-container"><header><h1>Color Picker</h1></header><main><div class="color-input"><label for="cp">Select Color:</label><input type="color" id="cp" value="#667eea"></div>';

const lower = code.toLowerCase();

// Test CSS detection logic
const isCSSByPattern = (code.match(/^[\s]*[.#a-z][\w-]*[\s]*\{/m) || 
                        code.match(/[\s]*[.#a-z][\w-]*[\s]*\{[\s\S]*?}/m) ||
                        (code.includes(':') && code.includes('{') && code.includes(';'))) &&
                       !lower.includes('<!doctype') && !lower.includes('<html') && !lower.includes('<div');

console.log('Code snippet:', code.substring(0, 100));
console.log('Detected as CSS?', isCSSByPattern);
console.log('Contains <div>?', lower.includes('<div'));
