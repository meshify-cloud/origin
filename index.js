const NodeMediaServer = require("./node-media-server/src/node_media_server.js");
const { getStreamKeyFromStreamPath, getApplicationFromStreamPath, getArrayFromEnv } = require("./utils");
require('dotenv').config();

const allowOrigin = process.env.ALLOW_ORIGIN || "*";
const port = Number(process.env.PORT) || 80;
const rtmpPort = Number(process.env.RTMP_PORT) || 1935;
const ffmpeg = process.env.FFMPEG || '/usr/bin/ffmpeg';
const hlsSegmentType = process.env.HLS_SEGMENT_TYPE || 'mpegts';
const validApplications = getArrayFromEnv('APPLICATIONS');
const validStreamKeys = getArrayFromEnv('STREAM_KEYS');
const pushStreamSecret = process.env.PUSH_STREAM_SECRET;
const allowIPs = getArrayFromEnv('ALLOW_IPS');
const transcodeTasks = JSON.parse(process.env.TRANS_TASKS || '[]');
const relayTasks = JSON.parse(process.env.RELAY_TASKS|| '[]');
const fissionTasks = JSON.parse(process.env.FISSION_TASKS|| '[]');
const publishCallbackUrl = process.env.PUBLISH_CALLBACK_URL;
const unpublishCallbackUrl = process.env.UNPUBLISH_CALLBACK_URL;
const httpApiToken = process.env.HTTP_API_TOKEN;

const createLogger = require("./logger.js");
const logLevel = process.env.LOG_LEVEL;
const logFile = !!process.env.LOG_FILE;
const logger = createLogger(logLevel || 'warn', logFile);

const httpConfig = {
    port, // HTTP port
    allow_origin: allowOrigin, // Allow requests from any origin (you may restrict this as needed)
    mediaroot: "./media", // Directory where the server will look for media files
    videoroot: "./videos",
    httpApiToken,
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
            // mp4: true,
        },
    ];
}

// console.warn(transformationConfig)

const relayConfig = {
    ffmpeg,
};
if (relayTasks.length > 0) {
    relayConfig.tasks = [...relayTasks];
} else {
    relayConfig.tasks = [
        {
            app: 'live',
            mode: 'static',
            edge: 'rtmp://liveuhd.spskjmtaz.site:80/static/h5',
            name: 'sintel'
        },
        //     {
        //     app: 'live',
        //     mode: 'static',
        //     edge: './videos/2025-04-01-17-50-15.mp4',
        //     name: 'sintel',
        //     loop: true,
        // }
    ];
}

const fissionConfig = {
    ffmpeg,
};
if (fissionTasks.length > 0) {
    fissionConfig.tasks = [...fissionTasks];
}

const config = {
    http: httpConfig,
    rtmp: rtmpConfig,
    trans: transformationConfig,
    relay: relayConfig,
    fission: fissionConfig,
};

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

nms.on('prePublish', (id, ip, streamPath, args) => {
    logger.debug(`[NodeEvent on prePublish] id=${id} ip=${ip} StreamPath=${streamPath} args=${JSON.stringify(args)}`);
    const reject = () => {
        let session = nms.getSession(id);
        session.reject();
    }
    let stream_key = getStreamKeyFromStreamPath(streamPath);
    let appName = getApplicationFromStreamPath(streamPath);
    if (validApplications.length > 0 && !validApplications.includes(appName)) {
        logger.warn(`prePublish reject app ${appName} ip ${ip}`);
        reject();
        return;
    }
    if ((validStreamKeys.length > 0 && !validStreamKeys.includes(stream_key))
        || (allowIPs.length > 0 && !allowIPs.includes(ip))) {
        logger.warn(`prePublish reject stream key ${stream_key} ip ${ip}`);
        reject();
        return;
    }
    if (pushStreamSecret && args["secret"] !== pushStreamSecret) {
        logger.warn(`prePublish secret not match, stream key ${stream_key} ip ${ip}`);
        reject();
        return;
    }
    if (publishCallbackUrl) {
        fetch(publishCallbackUrl, {
            method: 'POST', // 请求方法
            headers: {
                'Content-Type': 'application/json', // 请求头
            },
            body: JSON.stringify({
                action: "on_publish",
                client_id: id,
                ip,
                path: streamPath,
                args,
           }),
        })
            .then(response => {
                if (!response.ok) {
                    logger.warn('Publish Callback Not Allowed');
                    reject();
                }
            })
            .catch(error => {
                logger.warn('Publish Callback Error:', error);
                reject();
            });
    }
});

nms.on('postPublish', (id, StreamPath, args) => {
    logger.debug(`[NodeEvent on postPublish] id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, ip, streamPath, args) => {
    logger.debug(`[NodeEvent on donePublish] id=${id} StreamPath=${streamPath} args=${JSON.stringify(args)}`);
    if (unpublishCallbackUrl) {
        fetch(unpublishCallbackUrl, {
            method: 'POST', // 请求方法
            headers: {
                'Content-Type': 'application/json', // 请求头
            },
            body: JSON.stringify({
                action: "on_unpublish",
                client_id: id,
                ip,
                path: streamPath,
                args,
            }),
        })
    }
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
