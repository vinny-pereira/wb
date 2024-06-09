"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toolbar = void 0;
class Toolbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    connectedCallback() {
        this.createToolbar();
        console.log("toolbar created");
    }
    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.style.position = 'absolute';
        toolbar.style.top = '10px';
        toolbar.style.left = '10px';
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        toolbar.style.background = '#fff';
        toolbar.style.padding = '10px';
        toolbar.style.border = '1px solid #ccc';
        const lineWidthLabel = document.createElement('label');
        lineWidthLabel.textContent = 'Line Width:';
        lineWidthLabel.style.marginRight = '10px';
        toolbar.appendChild(lineWidthLabel);
        const lineWidthInput = document.createElement('input');
        lineWidthInput.type = 'number';
        lineWidthInput.min = '1';
        lineWidthInput.max = '20';
        lineWidthInput.value = '5';
        lineWidthInput.style.width = '50px';
        lineWidthInput.style.marginRight = '10px';
        lineWidthInput.addEventListener('change', (event) => {
            const lineWidth = event.target.value;
            this.dispatchEvent(new CustomEvent('lineWidthChange', { detail: { lineWidth: parseFloat(lineWidth) } }));
        });
        toolbar.appendChild(lineWidthInput);
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Color:';
        colorLabel.style.marginRight = '10px';
        toolbar.appendChild(colorLabel);
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.value = '#000000';
        colorInput.addEventListener('change', (event) => {
            const color = event.target.value;
            this.dispatchEvent(new CustomEvent('colorChange', { detail: { color } }));
        });
        toolbar.appendChild(colorInput);
        const squareButton = document.createElement('button');
        squareButton.textContent = 'Create Square';
        squareButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.dispatchEvent(new CustomEvent('rectModeActivated'));
        });
        toolbar.appendChild(squareButton);
        this.shadowRoot.appendChild(toolbar);
    }
}
exports.Toolbar = Toolbar;
customElements.define('wb-toolbar', Toolbar);
