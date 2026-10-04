// Component used for web browser of consoles, and for infoPanel. 
// It has richer HTML features than aframe-html.js, allows styles,...

AFRAME.registerComponent('html-panel', {
    init: function () {
        this.el.object3D.visible = false;

        // Create canvas for HTML rendering
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 682;
        this.canvas = canvas;

        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Create material and geometry for the plane
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true
        });
        const geometry = new THREE.PlaneGeometry(1.5, 1);

        // Create the mesh and add it to the entity
        this.mesh = new THREE.Mesh(geometry, material);
        this.el.setObject3D('mesh', this.mesh);
        this.el.object3D.visible = true;

        // Get HTML content element
        this.htmlContent = document.getElementById('html-content');

        // Set up click interaction
        this.el.addEventListener('click', this.handleClick.bind(this));
        this.el.addEventListener('mouseenter', this.handleMouseMove.bind(this));
        this.el.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.el.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Track hover state
        this.isHovering = false;
        this.hoverElements = [];
        this.activeElement = null;

        // Custom cursor for A-Frame scene
        this.cursor = document.querySelector('a-cursor');
        this.defaultCursorColor = this.cursor ? this.cursor.getAttribute('color') : '#4CC3D9';

        // Input focus tracking
        this.focusedInput = null;
        this.isTyping = false;

        // Track interactive elements
        this.interactiveElements = [
            {
                type: 'button',
                id: 'demo-button',
                x: 50,
                y: 410,
                width: 100,
                height: 30,
                hover: false,
                cursor: 'pointer'
            },
            {
                type: 'input',
                id: 'demo-input',
                x: 170,
                y: 410,
                width: 200,
                height: 30,
                hover: false,
                cursor: 'text'
            }
        ];

        // Set up button and input functionality
        this.setupInteractions();

        // Set up keyboard input
        window.addEventListener('keydown', this.handleKeyPress.bind(this));

        // Initial render
        this.renderHTML();
    },

    setupInteractions: function () {
        // Get interactive elements
        const button = document.getElementById('demo-button');
        const input = document.querySelector('.demo-input');

        if (button)
            // Add click event listener to button
            button.addEventListener('click', () => {
                // Toggle button color
                const currentColor = button.style.backgroundColor;
                button.style.backgroundColor = currentColor === 'rgb(231, 76, 60)' ? '#2ecc71' : '#e74c3c';

                // Apply active state styling
                button.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 100);

                // Re-render HTML
                this.renderHTML();
            });

        if (input)
            // Add focus event listener to input
            input.addEventListener('focus', () => {
                input.style.borderColor = '#3498db';
                input.style.boxShadow = '0 0 4px rgba(52, 152, 219, 0.5)';
                this.renderHTML();
            });

        if (input)
            // Add blur event listener to input
            input.addEventListener('blur', () => {
                input.style.borderColor = '#ddd';
                input.style.boxShadow = 'none';
                this.renderHTML();
            });
    },

    renderHTML: function () {
        // Make sure HTML content is visible for rendering
        const htmlContent = this.htmlContent;
        htmlContent.style.display = 'block';

        // Use html2canvas to render the HTML content
        html2canvas(htmlContent, {
            backgroundColor: null,
            useCORS: true,
            logging: false,
            scale: 1
        }).then(canvas => {
            // Draw the rendered HTML to our canvas
            const ctx = this.canvas.getContext('2d');
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.drawImage(canvas, 0, 0);

            // Update the texture
            this.mesh.material.map.needsUpdate = true;

            // Hide HTML content again
            htmlContent.style.display = 'none';
        }).catch(error => {
            console.error('Error rendering HTML:', error);
        });
    },

    handleMouseMove: function (evt) {
        if (!evt.detail.intersection) return;

        // Get click coordinates
        const uv = evt.detail.intersection.uv;
        const x = uv.x * this.canvas.width;
        const y = (1 - uv.y) * this.canvas.height;

        // Reset hover states
        let cursorType = 'default';
        let hoveredElement = null;

        // Check if hovering over any interactive element
        this.interactiveElements.forEach(element => {
            const isHovering =
                x >= element.x &&
                x <= element.x + element.width &&
                y >= element.y &&
                y <= element.y + element.height;

            // Update hover state
            element.hover = isHovering;

            if (isHovering) {
                cursorType = element.cursor;
                hoveredElement = element;
            }
        });

        // Update cursor appearance based on hover state
        if (this.cursor) {
            if (cursorType !== 'default') {
                this.cursor.setAttribute('color', '#FF6B6B');
                this.cursor.setAttribute('scale', '1.2 1.2 1.2');
            } else {
                this.cursor.setAttribute('color', this.defaultCursorColor);
                this.cursor.setAttribute('scale', '1 1 1');
            }
        }

        // If hovering over a new element, update and re-render
        if (hoveredElement !== this.activeElement) {
            this.activeElement = hoveredElement;

            // Apply hover effects to DOM elements if necessary
            const button = document.getElementById('demo-button');
            const input = document.querySelector('.demo-input');

            if (hoveredElement && hoveredElement.id === 'demo-button') {
                button.style.backgroundColor = button.style.backgroundColor === 'rgb(231, 76, 60)' ? '#e74c3c' : '#27ae60';
                button.style.transform = 'scale(1.03)';
            } else if (button) {
                button.style.backgroundColor = button.style.backgroundColor === 'rgb(231, 76, 60)' ? '#e74c3c' : '#2ecc71';
                button.style.transform = 'scale(1)';
            }

            if (hoveredElement && hoveredElement.id === 'demo-input') {
                input.style.borderColor = '#95a5a6';
            } else if (input && !this.focusedInput) {
                input.style.borderColor = '#ddd';
            }

            // Re-render HTML to show hover effects
            this.renderHTML();
        }
    },

    handleMouseLeave: function (evt) {
        // Reset hover states
        this.activeElement = null;

        // Reset cursor
        if (this.cursor) {
            this.cursor.setAttribute('color', this.defaultCursorColor);
            this.cursor.setAttribute('scale', '1 1 1');
        }

        // Reset styles on DOM elements
        const button = document.getElementById('demo-button');
        const input = document.querySelector('.demo-input');

        if (button) {
            button.style.backgroundColor = button.style.backgroundColor === 'rgb(231, 76, 60)' ? '#e74c3c' : '#2ecc71';
            button.style.transform = 'scale(1)';
        }

        if (input && !this.focusedInput) {
            input.style.borderColor = '#ddd';
        }

        // Re-render HTML
        this.renderHTML();
    },

    handleClick: function (evt) {
        if (!evt.detail.intersection) return;

        // Get click coordinates
        const uv = evt.detail.intersection.uv;
        const x = uv.x * this.canvas.width;
        const y = (1 - uv.y) * this.canvas.height;

        // Check which element was clicked
        this.interactiveElements.forEach(element => {
            const isClicked =
                x >= element.x &&
                x <= element.x + element.width &&
                y >= element.y &&
                y <= element.y + element.height;

            if (isClicked) {
                if (element.type === 'button') {
                    // Trigger click on the actual button
                    document.getElementById('demo-button').click();
                } else if (element.type === 'input') {
                    // Focus/blur the input
                    const input = document.querySelector('.demo-input');

                    if (this.focusedInput === input) {
                        input.blur();
                        this.focusedInput = null;
                        this.isTyping = false;
                    } else {
                        input.focus();
                        this.focusedInput = input;
                        this.isTyping = true;
                    }

                    this.renderHTML();
                }
            }
        });
    },

    handleKeyPress: function (event) {
        // Only handle key presses when an input is focused
        if (!this.isTyping || !this.focusedInput) return;

        const input = this.focusedInput;

        if (event.key === 'Backspace') {
            // Handle backspace key
            input.value = input.value.slice(0, -1);
        } else if (event.key === 'Enter') {
            // Handle enter key
            input.blur();
            this.focusedInput = null;
            this.isTyping = false;
        } else if (event.key.length === 1) {
            // Handle regular character input
            input.value += event.key;
        }

        // Re-render HTML after key press
        this.renderHTML();
    },

    update: function () {
        this.renderHTML();
    },

    tick: function () {
        // 
    }
});
