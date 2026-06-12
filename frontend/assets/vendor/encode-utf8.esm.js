/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/encode-utf8@1.0.3/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var u=function(u){for(var h=[],r=u.length,p=0;p<r;p++){var s=u.charCodeAt(p);if(s>=55296&&s<=56319&&r>p+1){var a=u.charCodeAt(p+1);a>=56320&&a<=57343&&(s=1024*(s-55296)+a-56320+65536,p+=1)}s<128?h.push(s):s<2048?(h.push(s>>6|192),h.push(63&s|128)):s<55296||s>=57344&&s<65536?(h.push(s>>12|224),h.push(s>>6&63|128),h.push(63&s|128)):s>=65536&&s<=1114111?(h.push(s>>18|240),h.push(s>>12&63|128),h.push(s>>6&63|128),h.push(63&s|128)):h.push(239,191,189)}return new Uint8Array(h).buffer};export{u as default};