type Stroke = {
    points: number[],
    id: string,
    color: number[],
    width: number
}

type Rect = {
    initialX: number,
    initialY: number,
    finalX: number,
    finalY: number,
    color: number[],
    id: string,
    strokeWidth: number
}

const enum CanvasMode{
    Line = 0,
    Square = 1
}
