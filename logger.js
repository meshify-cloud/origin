const winston = require('winston');
require('winston-daily-rotate-file');
const { createLogger, format, transports } = winston;

const commonFormat = [
    format.timestamp({ format: "YY-MM-DD HH:mm:ss" }),
    format.printf(
        (info) =>
            `${[info.timestamp]} ${info.level}: ${info.message}`
    ),
    format.errors({ stack: true }),
];

const transportArr = [
    new transports.Console({
        format: format.combine(
            format.colorize({ all: true }),
            ...commonFormat,
        ),
    })
];

module.exports = function(level = 'warn', writeToFile = false) {
    if (writeToFile) {
        const transport = new winston.transports.DailyRotateFile({
            filename: `master.log`,
            dirname: 'log',
            datePattern: 'YY-MM-DD',
            zippedArchive: true,
            maxSize: `1m`,
            maxFiles: `1d`,
            createSymlink: true,
            symlinkName: 'master.log',
            format: format.combine(
                ...commonFormat,
            ),
        });
        transportArr.push(transport);
    }
    return createLogger({
        level,
        transports: transportArr,
    });
}
