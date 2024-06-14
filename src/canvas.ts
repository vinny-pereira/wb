import './toolbar'
import { CanvasUtils } from './utils/canvas_utils'
import vertexShaderSource from './shaders/vertex_shader.vert'
import fragmentShaderSource from './shaders/fragment_shader.frag'

class Whiteboard extends HTMLCanvasElement {
    private gl: WebGLRenderingContext;
    private program: WebGLProgram | null = null;
    private positionAttributeLocation: number = -1;
    private resolutionUniformLocation: WebGLUniformLocation | null = null;
    private colorUniformLocation: WebGLUniformLocation | null = null;
    private buffer: WebGLBuffer | null = null;
    private drawing: boolean = false;
    private strokes: Stroke[] = [];
    private currentStrokeIndex: number | null = null;
    private rects: Rect[] = [];
    private currentRectIndex: number | null = null;
    private lineWidth: number = 5; 
    private strokeStyle: number[] = [0, 0, 0, 1];
    private socket: WebSocket | null = null;
    private mode: number = CanvasMode.Line;

    constructor() {
        super();
        this.id = 'whiteboard';
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.style.zIndex = '8';

        this.gl = this.getContext("webgl") as WebGLRenderingContext;
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

    static get observedAttributes(): string[]{
        return ['connectionDomain']
    }
    
    private createToolbar() {
        const toolbar = document.createElement('wb-toolbar');
        toolbar.addEventListener('lineWidthChange', (event) => {
            const customEvent = event as CustomEvent;
            this.lineWidth = customEvent.detail.lineWidth;
        });
        toolbar.addEventListener('colorChange', (event) => {
            const customEvent = event as CustomEvent;
            const hexColor = customEvent.detail.color.substring(1);
            this.strokeStyle = [
                parseInt(hexColor.substring(0, 2), 16) / 255,
                parseInt(hexColor.substring(2, 4), 16) / 255,
                parseInt(hexColor.substring(4, 6), 16) / 255,
                1
            ];
        });

        toolbar.addEventListener('rectModeActivated', () => {
            this.mode = CanvasMode.Square;
        });
        
        const parent = this.parentElement || document.body;
        parent.appendChild(toolbar);
    }


    private initShaderProgram() {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = this.createProgram(vertexShader, fragmentShader);
        this.positionAttributeLocation = this.gl.getAttribLocation(this.program, "a_position");
        this.resolutionUniformLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.colorUniformLocation = this.gl.getUniformLocation(this.program, "u_color");

        this.gl.useProgram(this.program);
    }

    private createShader(type: number, source: string): WebGLShader {
        const shader = this.gl.createShader(type) as WebGLShader;
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error("Error compiling shader: " + this.gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    private createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
        const program = this.gl.createProgram() as WebGLProgram;
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error("Error linking program: " + this.gl.getProgramInfoLog(program));
        }

        return program;
    }

    private initBuffers() {
        this.buffer = this.gl.createBuffer() as WebGLBuffer;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }

    private draw() {
        let resize = CanvasUtils.resizeCanvasToDisplaySize(this.gl.canvas as HTMLCanvasElement);
        if(resize)
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

        this.strokes.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 4) return;

            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(stroke.points), this.gl.STATIC_DRAW);

            this.gl.vertexAttribPointer(this.positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(this.positionAttributeLocation);

            this.gl.uniform2f(this.resolutionUniformLocation, this.width, this.height);
            this.gl.uniform4fv(this.colorUniformLocation, stroke.color);

            this.gl.lineWidth(stroke.width);

            this.gl.drawArrays(this.gl.LINE_STRIP, 0, stroke.points.length / 2);
        });
        
        this.rects.forEach(rect => {
            if (rect.finalX === undefined || rect.finalY === undefined) return;

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

    onMouseDown(e: MouseEvent) {
        this.drawing = true;
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if(this.mode === CanvasMode.Line){
            this.currentStrokeIndex = this.strokes.length;
            this.strokes.push({
                color: this.strokeStyle,
                width: this.lineWidth,
                id: this.guid(),
                points: [x, y]
            } as Stroke);
        }
        if(this.mode === CanvasMode.Square){
            this.currentRectIndex = this.rects.length;
            this.rects.push({
                initialX: x,
                initialY: y,
                color: this.strokeStyle,
                strokeWidth: this.lineWidth,
                id: this.guid()
            } as Rect);
        }
    }

    private guid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
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

    onMouseMove(e: MouseEvent) {
        if (!this.drawing) return;

        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if(this.mode === CanvasMode.Line){
            if(this.currentStrokeIndex === null) return;
            this.strokes[this.currentStrokeIndex].points.push(x, y);
        }
        if(this.mode === CanvasMode.Square){
            if(this.currentRectIndex === null) return;
            this.rects[this.currentRectIndex].finalX = x;
            this.rects[this.currentRectIndex].finalY = y;
        }

        this.draw();

        if(!this.socket || !this.currentStrokeIndex) return;
        this.socket.send(JSON.stringify({
            type: 'draw',
            data: this.strokes[this.currentStrokeIndex].points
        }));
    }

    connectedCallback() {
        console.log("Whiteboard connected.");

        const connectionDomain: string | null = this.getAttribute('connectionDomain');

        if(!connectionDomain) return;

        this.socket = new WebSocket(`ws:${connectionDomain}`);
        this.socket.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if(message.type === 'draw'){
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

    attributeChangedCallback(name?: string, oldValue?: string, newValue?: string): void {
        console.log(`Attribute ${name} has changed from ${oldValue} to ${newValue}.`);
    }
}

customElements.define("wb-whiteboard", Whiteboard, { extends: 'canvas' });
