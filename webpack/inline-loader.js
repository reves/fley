module.exports = function (source) {
    
    const container = {
        node: null,
        inline: source
    }

    return `module.exports = () => {return ${JSON.stringify(container)}}`;
}
