
const getStreamKeyFromStreamPath = (path) => {
    let parts = path.split('/');
    return parts[parts.length - 1];
};

const getApplicationFromStreamPath = (path) => {
    let parts = path.split('/');
    return parts[parts.length - 2];
};

const getArrayFromEnv = (name) => {
    const arr = process.env[name] ? process.env[name].split(',') : [];
    return arr.map(item => item.trim())
}

module.exports = {
    getStreamKeyFromStreamPath,
    getArrayFromEnv,
    getApplicationFromStreamPath,
}
