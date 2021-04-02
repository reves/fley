module.exports = function (inline) {
    return `module.exports = ${JSON.stringify({inline})}`;
}
