export class CanvasUtils{
    
    static resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean{
        const resize: boolean = canvas.width  !== canvas.clientWidth ||canvas.height !== canvas.clientHeight;

        if (resize){    
            canvas.width  = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }
        
        return resize;
    }
}

