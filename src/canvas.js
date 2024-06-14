"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./toolbar");
const canvas_utils_1 = require("./utils/canvas_utils");
const vertex_shader_vert_1 = __importDefault(require("./shaders/vertex_shader.vert"));
const fragment_shader_frag_1 = __importDefault(require("./shaders/fragment_shader.frag"));
class Whiteboard extends HTMLCanvasElement {
    constructor() {
        super();
        this.program = null;
        this.positionAttributeLocation = -1;
        this.resolutionUniformLocation = null;
        this.colorUniformLocation = null;
        this.buffer = null;
        this.drawing = false;
        this.strokes = [];
        this.currentStrokeIndex = null;
        this.rects = [];
        this.currentRectIndex = null;
        this.lineWidth = 5;
        this.strokeStyle = [0, 0, 0, 1];
        this.socket = null;
        this.mode = 0 /* CanvasMode.Line */;
        this.cornerRadius = 10;
        this.id = 'whiteboard';
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.style.zIndex = '8';
        this.gl = this.getContext("webgl");
        if (!this.gl) {
            throw new Error("Couldn't create WebGL rendering context");
        }
        this.initShaderProgram();
        this.initBuffers();
        this.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.createToolbar();
    }
    static get observedAttributes() {
        return ['connectionDomain'];
    }
    createToolbar() {
        const toolbar = document.createElement('wb-toolbar');
        toolbar.addEventListener('lineWidthChange', (event) => {
            const customEvent = event;
            this.lineWidth = customEvent.detail.lineWidth;
        });
        toolbar.addEventListener('colorChange', (event) => {
            const customEvent = event;
            const hexColor = customEvent.detail.color.substring(1);
            this.strokeStyle = [
                parseInt(hexColor.substring(0, 2), 16) / 255,
                parseInt(hexColor.substring(2, 4), 16) / 255,
                parseInt(hexColor.substring(4, 6), 16) / 255,
                1
            ];
        });
        toolbar.addEventListener('rectModeActivated', () => {
            this.mode = 1 /* CanvasMode.Square */;
        });
        const parent = this.parentElement || document.body;
        parent.appendChild(toolbar);
    }
    initShaderProgram() {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertex_shader_vert_1.default);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragment_shader_frag_1.default);
        this.program = this.createProgram(vertexShader, fragmentShader);
        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.resolutionUniformLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.colorUniformLocation = this.gl.getUniformLocation(this.program, "u_color");
        const radiusUniformLocation = this.gl.getUniformLocation(this.program, "u_radius");
        this.gl.useProgram(this.program);
        this.gl.uniform1f(radiusUniformLocation, this.cornerRadius / this.width);
    }
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error("Error compiling shader: " + this.gl.getShaderInfoLog(shader));
        }
        return shader;
    }
    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error("Error linking program: " + this.gl.getProgramInfoLog(program));
        }
        return program;
    }
    initBuffers() {
        this.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }
    draw() {
        let resize = canvas_utils_1.CanvasUtils.resizeCanvasToDisplaySize(this.gl.canvas);
        if (resize)
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.strokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 4)
                return;
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(stroke.points), this.gl.STATIC_DRAW);
            this.gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(this.positionAttributeLocation);
            this.gl.uniform2f(this.resolutionUniformLocation, this.width, this.height);
            this.gl.uniform4fv(this.colorUniformLocation, stroke.color);
            this.gl.lineWidth(stroke.width);
            this.gl.drawArrays(this.gl.LINE_STRIP, 0, stroke.points.length / 2);
        });
        this.rects.forEach(rect => {
            if (rect.finalX === undefined || rect.finalY === undefined)
                return;
            const x1 = rect.initialX;
            const y1 = rect.initialY;
            const x2 = rect.finalX;
            const y2 = rect.finalY;
            const points = [
                x1, y1,
                x2, y1,
                x2, y2,
                x1, y2,
                x1, y1
            ];
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(points), this.gl.STATIC_DRAW);
            this.gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(this.positionAttributeLocation);
            this.gl.uniform2f(this.resolutionUniformLocation, this.width, this.height);
            this.gl.uniform4fv(this.colorUniformLocation, rect.color);
            this.gl.lineWidth(rect.strokeWidth);
            this.gl.drawArrays(this.gl.LINE_STRIP, 0, points.length / 2);
        });
    }
    onMouseDown(e) {
        this.drawing = true;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (this.mode === 0 /* CanvasMode.Line */) {
            this.currentStrokeIndex = this.strokes.length;
            this.strokes.push({
                color: this.strokeStyle,
                width: this.lineWidth,
                id: this.guid(),
                points: [x, y]
            });
        }
        if (this.mode === 1 /* CanvasMode.Square */) {
            this.currentRectIndex = this.rects.length;
            this.rects.push({
                initialX: x,
                initialY: y,
                color: this.strokeStyle,
                strokeWidth: this.lineWidth,
                id: this.guid()
            });
        }
    }
    guid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = Math.random() * 16 | 0;
            let v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    onMouseUp() {
        if (this.drawing) {
            this.drawing = false;
            this.currentStrokeIndex = null;
            this.currentRectIndex = null;
        }
    }
    onMouseMove(e) {
        if (!this.drawing)
            return;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (this.mode === 0 /* CanvasMode.Line */) {
            if (this.currentStrokeIndex === null)
                return;
            this.strokes[this.currentStrokeIndex].points.push(x, y);
        }
        if (this.mode === 1 /* CanvasMode.Square */) {
            if (this.currentRectIndex === null)
                return;
            this.rects[this.currentRectIndex].finalX = x;
            this.rects[this.currentRectIndex].finalY = y;
        }
        this.draw();
        if (!this.socket || !this.currentStrokeIndex)
            return;
        this.socket.send(JSON.stringify({
            type: 'draw',
            data: this.strokes[this.currentStrokeIndex].points
        }));
    }
    connectedCallback() {
        console.log("Whiteboard connected.");
        const connectionDomain = this.getAttribute('connectionDomain');
        if (!connectionDomain)
            return;
        this.socket = new WebSocket(`ws:${connectionDomain}`);
        this.socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'draw') {
                this.strokes.push(message.data);
                this.draw();
            }
        });
    }
    disconnectedCallback() {
        console.log("Whiteboard disconnected");
    }
    adoptedCallback() {
        console.log("Whiteboard moved to new page.");
    }
    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`Attribute ${name} has changed from ${oldValue} to ${newValue}.`);
    }
}
customElements.define("wb-whiteboard", Whiteboard, { extends: 'canvas' });
