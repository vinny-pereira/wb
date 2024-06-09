export class Toolbar extends HTMLElement {
    constructor() {
        super();
        this.loadTemplate();
    }

    connectedCallback() {
        this.querySelector('#line-width')?.addEventListener('change', (event) => {
            const lineWidth = (event.target as HTMLInputElement).value;
            this.dispatchEvent(new CustomEvent('lineWidthChange', { detail: { lineWidth: parseFloat(lineWidth) } }));
        });

        this.querySelector('#color')?.addEventListener('change', (event) => {
            const color = (event.target as HTMLInputElement).value;
            this.dispatchEvent(new CustomEvent('colorChange', { detail: { color } }));
        });
    }

    async loadTemplate() {
        const response = await fetch('toolbar.js.html');
        const text = await response.text();
        this.innerHTML = text;
    }
}

customElements.define('wb-toolbar', Toolbar);
