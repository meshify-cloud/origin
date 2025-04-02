
## Origin Server
Built on the top of [Node-Media-Server](https://github.com/illuspas/Node-Media-Server)

## Environment Variable
| Field     | Description              | Require  | Default |
| --------- | ------------------------ | -------- | ------- |
| FFMPEG    | The path to ffmpeg executable file | No       | '/usr/bin/ffmpeg'  |
| HLS_SEGMENT_TYPE | The hls segment type(fmp4, mpegts) | No       | 'mpegts'  |
| LOG_LEVEL | debug, info, warn, error | No       | 'warn'  |
| LOG_FILE  | debug, info, warn, error | No       | false   |
| PORT      | The http server port     | No       | 80      |
| RTMP_PORT | The rtmp port     | No       | 1935      |
| APPLICATIONS | The array of application names that allowed to push stream | No       | []   |
| STREAM_KEYS | The array of stream key that allowed to push stream | No       | []   |
| TRANS_TASKS | The array of transcode task passed to node media server | No       | []   |
| RELAY_TASKS | The array of relay task passed to node media server | No       | []   |
| FISSION_TASKS | The array of fission task passed to node media server | No       | []   |
| ALLOW_ORIGIN | Value for Access-Control-Allow-Origin | No   | '*'   |
| ALLOW_IPS | The array of ip that allowed to push stream | No       | []   |
| PUSH_STREAM_SECRET | The stream key secret | No       | ''   |
| PUBLISH_CALLBACK_URL | When client publish /stream, call the hook, post a body with stream and client info, if valid, the hook must return HTTP code 200(Status OK)  | No       | ''   |
| UNPUBLISH_CALLBACK_URL | When client stop publish, call the hook, post a body with stream and client info | No       | ''   |
| HTTP_API_TOKEN | The token to request api server | No       | ''   |
