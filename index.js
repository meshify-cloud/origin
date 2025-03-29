const NodeMediaServer = require("./node-media-server/src/node_media_server.js");
const { getStreamKeyFromStreamPath, getArrayFromEnv } = require("./utils");
require('dotenv').config();
const allowOrigin = process.env.ALLOW_ORIGIN || "*";
const port = Number(process.env.PORT) || 80;
const rtmpPort = Number(process.env.RTMP_PORT) || 1935;
const ffmpeg = process.env.FFMPEG || '/usr/bin/ffmpeg';
const hlsSegmentType = process.env.HLS_SEGMENT_TYPE || 'mpegts';
const validStreamKeys = getArrayFromEnv('STREAM_KEYS');
const allowIPs = getArrayFromEnv('ALLOW_IPS');
const transcodeTasks = JSON.parse(process.env.TRANS_TASKS || '[]');
const relayTasks = JSON.parse(process.env.RELAY_TASKS|| '[]');
const fissionTasks = JSON.parse(process.env.FISSION_TASKS|| '[]');
const createLogger = require("./logger.js");


const logLevel = process.env.LOG_LEVEL;
const logFile = !!process.env.LOG_FILE;
const logger = createLogger(logLevel || 'warn', logFile);

const httpConfig = {
    port, // HTTP port
    allow_origin: allowOrigin, // Allow requests from any origin (you may restrict this as needed)
    mediaroot: "./media", // Directory where the server will look for media files
};

const rtmpConfig = {
    port: rtmpPort, // RTMP port, 1935 is the default port for RTMP
    chunk_size: 60000, // The size in bytes of the chunks into which the media file will be divided
    gop_cache: true, // If true, the server will use a GOP (Group of Pictures) cache. This will improve the efficiency of RTMP streaming but will also increase memory usage
    ping: 10, // Ping interval in seconds. This will send a ping message to the client to check if the connection is alive
    ping_timeout: 60, // Ping timeout in seconds
};

const transformationConfig = {
    ffmpeg,
};

if (transcodeTasks.length > 0) {
    transformationConfig.tasks = [...transcodeTasks];
} else {
    transformationConfig.tasks = [
        {
            app: "live",
            vc: "libx264",
            vcParam: ['-vb', '1000k'],
            ac: "aac",
            acParam: ['-ab', '64k', '-ac', '1', '-ar', '44100'],
            hls: true,
            hlsFlags: `[start_number=1:hls_segment_type=${hlsSegmentType}:strftime=1:hls_time=4:hls_list_size=8:hls_flags=delete_segments:hls_flags=split_by_time]`,
            hlsKeep: false,
        },
    ];
}

// console.warn(transformationConfig)

const config = {
    http: httpConfig,
    rtmp: rtmpConfig,
    trans: transformationConfig,
};

if (relayTasks.length > 0) {
    config.relay = {
        ffmpeg,
        tasks: [...relayTasks]
    }
}
if (fissionTasks.length > 0) {
    config.fission = {
        ffmpeg,
        tasks: [...fissionTasks]
    }
}

const nms = new NodeMediaServer(config);

nms.run();

nms.on('preConnect', (id, ip, args) => {
    logger.debug(`[NodeEvent on preConnect] id=${id} args=${JSON.stringify(args)}`);
    // let session = nms.getSession(id);
    // session.reject();
});

nms.on('postConnect', (id, args) => {
    logger.debug(`[NodeEvent on postConnect] id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
    logger.debug(`[NodeEvent on doneConnect] id=${id} args=${JSON.stringify(args)}`);
});

nms.on('prePublish', (id, ip, StreamPath, args) => {
    logger.debug(`[NodeEvent on prePublish] id=${id} ip=${ip} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    let stream_key = getStreamKeyFromStreamPath(StreamPath);
    if ((validStreamKeys.length > 0 && !validStreamKeys.includes(stream_key))
        || (allowIPs.length > 0 && !allowIPs.includes(ip))) {
        logger.warn(`prePublish reject stream key ${stream_key} ip ${ip}`);
        let session = nms.getSession(id);
        session.reject();
    }
});

nms.on('postPublish', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on postPublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on donePublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on prePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
    // let session = nms.getSession(id);
    // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on postPlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on donePlay] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});
