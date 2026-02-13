const multer = require("multer");

const chatUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter(req, file, cb) {
        const allowed = [
            "image/jpeg", "image/png", "image/webp",
            "application/pdf"
        ];
        if (!allowed.includes(file.mimetype)) {
            return cb(new Error("Only JPG, PNG, WebP images and PDF documents are allowed"));
        }
        cb(null, true);
    },
});

module.exports = chatUpload;
