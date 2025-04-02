const fs = require('fs');
const path = require('path');

// 清空文件夹的函数
const clearDirectory = (dirPath) => {
    try {
        // 读取目录中的所有文件/子目录
        const files = fs.readdirSync(dirPath);

        // 遍历并删除每个文件/子目录
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                // 如果是子目录，递归删除
                clearDirectory(filePath);
                fs.rmdirSync(filePath); // 删除空目录
            } else {
                // 如果是文件，直接删除
                fs.unlinkSync(filePath);
            }
        }

        return {
            success: true,
            message: `Clear ${dirPath} successful`,
            deletedCount: files.length
        };
    } catch (error) {
        return {
            success: false,
            message: `Clear err: ${error.message}`,
            error: error
        };
    }
};



const authenticateToken = (realToken) => {
    return (req, res, next) => {
        // 从请求头获取 Authorization
        const authHeader = req.headers['authorization'];

        // 检查是否存在 Authorization 头
        if (!authHeader) {
            return res.status(401).json({
                message: 'token is required',
            });
        }

        // 检查格式是否为 Bearer Token (Bearer <token>)
        const [bearer, token] = authHeader.split(' ');

        if (bearer !== 'Bearer' || !token) {
            return res.status(401).json({
                message: 'invalid token format',
            });
        }

        if (realToken !== token) {
            return res.status(403).json({
                message: 'Token is not valid',
            });
        }

        // 验证通过，继续下一个中间件
        next();
    }
};

module.exports = {
    clearDirectory,
    authenticateToken,
}
