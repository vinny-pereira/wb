"use strict";
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
        this.lineWidth = 5;
        this.strokeStyle = [0, 0, 0, 1];
        this.socket = null;
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
        const toolbar = document.createElement('div');
        toolbar.style.position = 'absolute';
        toolbar.style.top = '10px';
        toolbar.style.left = '10px';
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        const lineWidthLabel = document.createElement('label');
        lineWidthLabel.textContent = 'Line Width:';
        toolbar.appendChild(lineWidthLabel);
        const lineWidthInput = document.createElement('input');
        lineWidthInput.type = 'number';
        lineWidthInput.min = '1';
        lineWidthInput.max = '20';
        lineWidthInput.value = this.lineWidth.toString();
        lineWidthInput.addEventListener('change', () => {
            this.lineWidth = parseFloat(lineWidthInput.value);
        });
        toolbar.appendChild(lineWidthInput);
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Color:';
        toolbar.appendChild(colorLabel);
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = `#${this.strokeStyle.slice(0, 3).map(c => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;
        colorInput.addEventListener('change', () => {
            const hexColor = colorInput.value.substring(1);
            this.strokeStyle = [
                parseInt(hexColor.substring(0, 2), 16) / 255,
                parseInt(hexColor.substring(2, 4), 16) / 255,
                parseInt(hexColor.substring(4, 6), 16) / 255,
                1
            ];
        });
        toolbar.appendChild(colorInput);
        const parent = this.parentElement || document.body;
        parent.appendChild(toolbar);
    }
    initShaderProgram() {
        const vertexShaderSource = `
            attribute vec2 a_position;

            uniform vec2 u_resolution;

            void main() {
                vec2 zeroToOne = a_position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;

                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
            }
        `;
        const fragmentShaderSource = `
            precision mediump float;

            uniform vec4 u_color;

            void main() {
                gl_FragColor = u_color;
            }
        `;
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);
        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.resolutionUniformLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.colorUniformLocation = this.gl.getUniformLocation(this.program, "u_color");
        this.gl.useProgram(this.program);
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
    drawLines() {
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
    }
    onMouseDown(e) {
        this.drawing = true;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.currentStrokeIndex = this.strokes.length;
        this.strokes.push({
            color: this.strokeStyle,
            width: this.lineWidth,
            id: this.guid(),
            points: [x, y]
        });
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
        }
    }
    onMouseMove(e) {
        if (!this.drawing)
            return;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (this.currentStrokeIndex === null)
            return;
        this.strokes[this.currentStrokeIndex].points.push(x, y);
        this.drawLines();
        if (!this.socket)
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
                this.drawLines();
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
