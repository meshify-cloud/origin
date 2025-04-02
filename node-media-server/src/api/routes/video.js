const express = require("express");
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { clearDirectory } = require("../utils");

module.exports = (context) => {
    const { videoroot } = context.conf.http;

    // 配置multer用于文件上传
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, videoroot);
        },
        filename: (req, file, cb) => {
            // 使用原始文件名，但需要处理可能的安全问题
            const originalname = file.originalname;

            // 安全处理：移除路径信息，只保留文件名
            const filename = path.basename(originalname);

            // 可选：检查文件名是否已存在，如果存在则添加后缀
            let finalFilename = filename;
            let counter = 1;
            while (fs.existsSync(path.join(videoroot, finalFilename))) {
                const ext = path.extname(filename);
                const name = path.basename(filename, ext);
                finalFilename = `${name}_${counter}${ext}`;
                counter++;
            }

            cb(null, finalFilename);
        }
    });

    const upload = multer({
        storage: storage,
        fileFilter: (req, file, cb) => {
            if (path.extname(file.originalname).toLowerCase() !== '.mp4') {
                return cb(new Error('Only MP4 files are allowed'));
            }
            cb(null, true);
        },
        limits: {
            fileSize: 1000 * 1024 * 1024 // 限制1000MB
        }
    });

    let router = express.Router();

    // 1. 查询MP4文件列表
    router.get('/list', (req, res) => {
        try {
            const files = fs.readdirSync(videoroot);
            const mp4Files = files.filter(file => file.toLowerCase().endsWith('.mp4'));

            // 获取文件信息
            const filesWithInfo = mp4Files.map(file => {
                const filePath = path.join(videoroot, file);
                const stats = fs.statSync(filePath);
                return {
                    name: file,
                    size: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                };
            });

            res.json({
                success: true,
                count: mp4Files.length,
                files: filesWithInfo
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to read directory',
                error: error.message
            });
        }
    });

    // 2. 删除MP4文件
    router.delete('/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(videoroot, filename);

        if (filename === 'all') {
            // 执行清空操作
            const result = clearDirectory(videoroot);

            if (result.success) {
                res.json({
                    success: true,
                    message: result.message,
                    deletedCount: result.deletedCount
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: result.message,
                    error: result.error.toString()
                });
            }
            return
        }

        // 安全检查
        if (!filename.toLowerCase().endsWith('.mp4')) {
            return res.status(400).json({
                success: false,
                message: 'Only .mp4 files can be deleted'
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        try {
            fs.unlinkSync(filePath);
            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to delete file',
                error: error.message
            });
        }
    });

    // 3. 批量删除MP4文件
    router.delete('/', (req, res) => {
        const { filenames } = req.body;

        if (!Array.isArray(filenames) || filenames.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of filenames to delete'
            });
        }

        const results = [];
        let successCount = 0;

        filenames.forEach(filename => {
            const filePath = path.join(videoroot, filename);

            // 安全检查
            if (!filename.toLowerCase().endsWith('.mp4')) {
                results.push({
                    filename,
                    success: false,
                    message: 'Not an MP4 file'
                });
                return;
            }

            if (!fs.existsSync(filePath)) {
                results.push({
                    filename,
                    success: false,
                    message: 'File not found'
                });
                return;
            }

            try {
                fs.unlinkSync(filePath);
                results.push({
                    filename,
                    success: true,
                    message: 'Deleted successfully'
                });
                successCount++;
            } catch (error) {
                results.push({
                    filename,
                    success: false,
                    message: error.message
                });
            }
        });

        res.json({
            success: successCount === filenames.length,
            total: filenames.length,
            successCount,
            failedCount: filenames.length - successCount,
            results
        });
    });

    // 4. 重命名MP4文件
    router.put('/:oldFilename', (req, res) => {
        const oldFilename = req.params.oldFilename;
        const newFilename = req.body.newFilename;

        if (!newFilename) {
            return res.status(400).json({
                success: false,
                message: 'New filename is required'
            });
        }

        // 确保新文件名以.mp4结尾
        if (!newFilename.toLowerCase().endsWith('.mp4')) {
            return res.status(400).json({
                success: false,
                message: 'New filename must end with .mp4'
            });
        }

        const oldPath = path.join(videoroot, oldFilename);
        const newPath = path.join(videoroot, newFilename);

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({
                success: false,
                message: 'Original file not found'
            });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({
                success: false,
                message: 'A file with the new name already exists'
            });
        }

        try {
            fs.renameSync(oldPath, newPath);
            res.json({
                success: true,
                message: 'File renamed successfully',
                oldFilename,
                newFilename
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to rename file',
                error: error.message
            });
        }
    });

    // 5. 上传MP4文件
    router.post('/upload', upload.single('video'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.json({
            success: true,
            message: 'File uploaded successfully',
            filename: req.file.filename,
            size: req.file.size,
            path: req.file.path
        });
    });

    // 6. 下载MP4文件
    router.get('/download/:filename', (req, res) => {
        const filename = req.params.filename;
        const filePath = path.join(videoroot, filename);

        // 安全检查
        if (!filename.toLowerCase().endsWith('.mp4')) {
            return res.status(400).json({
                success: false,
                message: 'Only .mp4 files can be downloaded'
            });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // 设置适当的headers
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-Type', 'video/mp4');

        // 创建文件流并pipe到响应
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('error', (error) => {
            res.status(500).json({
                success: false,
                message: 'Error streaming file',
                error: error.message
            });
        });
    });

    return router;
};
