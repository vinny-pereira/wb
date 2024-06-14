"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CanvasUtils = void 0;
class CanvasUtils {
    static resizeCanvasToDisplaySize(canvas) {
        const resize = canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight;
        if (resize) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
        return resize;
    }
}
exports.CanvasUtils = CanvasUtils;
