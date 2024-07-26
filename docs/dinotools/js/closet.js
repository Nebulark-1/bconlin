document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const bodyCanvas = document.getElementById('body-canvas');
    const bodyCtx = bodyCanvas.getContext('2d');
    const bellyCanvas = document.getElementById('belly-canvas');
    const bellyCtx = bellyCanvas.getContext('2d');
    const patternCanvas = document.getElementById('pattern-canvas');
    const patternCtx = patternCanvas.getContext('2d');
    const cosmeticCanvas = document.createElement('canvas');
    cosmeticCanvas.id = 'cosmetic-canvas';
    cosmeticCanvas.width = 160;
    cosmeticCanvas.height = 160;
    cosmeticCanvas.style.position = 'absolute';
    cosmeticCanvas.style.top = '0';
    cosmeticCanvas.style.left = '0';
    canvasContainer.appendChild(cosmeticCanvas);
    const cosmeticCtx = cosmeticCanvas.getContext('2d');
    
    const bodyImage = new Image();
    const bellyImage = new Image();
    bodyImage.src = '../assets/images/body.png';
    bellyImage.src = '../assets/images/belly.png';

    const DEFAULT_DINO_WIDTH = 206;
    const DEFAULT_DINO_HEIGHT = 170;

    let originalColors = [];
    let secondaryColors = [];
    let selectedPattern = 'splotchy';
    let selectedPatternColor = '#9e5722'; // Brown
    let selectedCosmetics = [
        {
            "name": "Gold Crown",
            "image": "gold_crown.png",
            "category": "head",
            "position": {"x": 38, "y": 2, "width": 30, "height": 30}
        },    
        {
            "name": "Royal Cloak",
            "image": "royal_cloak.png",
            "category": "body",
            "position": {"x": 36, "y": 32, "width": 30, "height": 30}
        },  
    ]; // Default to show the crown
    let bodyColor = '#69944f'; // Olive
    let bellyColor = '#d3fe09'; // Lime

    bodyImage.onload = () => {
        renderBodyCanvas();
    };

    bellyImage.onload = () => {
        renderBellyCanvas();
    };

    fetch('../assets/json/colors.json')
        .then(response => response.json())
        .then(colors => {
            originalColors = colors; // Store the original order of colors
            displayColors(colors, 'body-color-options', 'body-sort-options', 'body', bodyColor);
        })
        .catch(error => console.error('Error fetching colors:', error));

    fetch('../assets/json/secondary.json')
        .then(response => response.json())
        .then(colors => {
            secondaryColors = colors; // Store the secondary colors for belly and pattern
            displayColors(colors, 'belly-color-options', 'belly-sort-options', 'belly', bellyColor);
            displayColors(colors, 'pattern-color-options', 'pattern-sort-options', 'pattern-color', selectedPatternColor);
        })
        .catch(error => console.error('Error fetching secondary colors:', error));

    fetch('../assets/json/patterns.json')
        .then(response => response.json())
        .then(patterns => {
            const patternOptions = document.getElementById('pattern-options');
            patternOptions.innerHTML = ''; // Clear existing options
            displayPatterns(patterns);
        })
        .catch(error => console.error('Error fetching patterns:', error));

    fetch('../assets/json/cosmetics.json')
        .then(response => response.json())
        .then(cosmetics => {
            const cosmeticsOptions = document.getElementById('cosmetics-options');
            cosmetics.forEach(cosmetic => {
                const label = document.createElement('label');
                label.className = 'cosmetics-label';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.name = 'cosmetics';
                checkbox.className = 'cosmetics-checkbox';
                checkbox.dataset.cosmetic = JSON.stringify(cosmetic);

                const cosmeticImage = document.createElement('div');
                cosmeticImage.className = 'cosmetics-image';
                cosmeticImage.style.backgroundImage = `url(../assets/images/cosmetics/${cosmetic.image.replace('.png', '1.png')})`;

                label.appendChild(checkbox);
                label.appendChild(cosmeticImage);
                label.appendChild(document.createTextNode(` ${cosmetic.name}`));
                cosmeticsOptions.appendChild(label);

                checkbox.addEventListener('change', () => {
                    const cosmeticData = JSON.parse(checkbox.dataset.cosmetic);

                    // Remove existing cosmetic of the same category
                    selectedCosmetics = selectedCosmetics.filter(c => c.category !== cosmeticData.category);

                    if (checkbox.checked) {
                        selectedCosmetics.push(cosmeticData);
                    }
                    renderCosmetics();
                });
            });
        })
        .catch(error => console.error('Error fetching cosmetics:', error));

    function displayColors(colors, containerId, sortId, type, defaultColor) {
        const colorOptions = document.getElementById(containerId);
        const sortOptions = document.getElementById(sortId);
        colorOptions.innerHTML = ''; // Clear existing options
        colors.forEach(color => {
            const label = document.createElement('label');

            const colorSquare = document.createElement('div');
            colorSquare.className = 'color-square';
            colorSquare.style.backgroundColor = color.hex;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = containerId;
            radio.className = 'color-radio';
            radio.dataset.color = color.hex;
            radio.dataset.type = type;

            if (color.hex.toUpperCase() === defaultColor.toUpperCase()) {
                radio.checked = true;
            }

            label.appendChild(radio);
            label.appendChild(colorSquare);
            label.appendChild(document.createTextNode(` ${color.name}`));
            colorOptions.appendChild(label);

            radio.addEventListener('change', () => {
                if (type === 'body') {
                    bodyColor = color.hex;
                    renderBodyCanvas();
                } else if (type === 'belly') {
                    bellyColor = color.hex;
                    renderBellyCanvas();
                } else if (type === 'pattern-color') {
                    selectedPatternColor = color.hex;
                    renderPattern();
                }
            });
        });

        sortOptions.addEventListener('change', (event) => {
            const sortBy = event.target.value;
            let sortedColors;
            switch (sortBy) {
                case 'name':
                    sortedColors = [...colors].sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'hex':
                    sortedColors = [...colors].sort((a, b) => hexToHSL(a.hex).h - hexToHSL(b.hex).h);
                    break;
                case 'default':
                default:
                    sortedColors = originalColors;
                    break;
            }
            displayColors(sortedColors, containerId, sortId, type, defaultColor);
        });
    }

    function displayPatterns(patterns) {
        const patternOptions = document.getElementById('pattern-options');
        patternOptions.innerHTML = ''; // Clear existing options
        patterns.forEach(pattern => {
            const label = document.createElement('label');
            label.className = 'pattern-label';

            const patternImage = document.createElement('div');
            patternImage.className = 'pattern-image';
            patternImage.style.backgroundImage = `url(../assets/images/patterns/${pattern}1.png)`;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'pattern';
            radio.className = 'pattern-radio';
            radio.dataset.pattern = pattern;

            if (pattern === selectedPattern) {
                radio.checked = true;
            }

            label.appendChild(patternImage);
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${formatName(pattern)}`));
            patternOptions.appendChild(label);

            radio.addEventListener('change', () => {
                selectedPattern = pattern;
                renderPattern();
            });
        });

        const sortOptions = document.getElementById('pattern-sort-options');
        sortOptions.addEventListener('change', (event) => {
            const sortBy = event.target.value;
            let sortedPatterns;
            switch (sortBy) {
                case 'name':
                    sortedPatterns = [...patterns].sort((a, b) => a.localeCompare(b));
                    break;
                case 'default':
                default:
                    sortedPatterns = patterns;
                    break;
            }
            displayPatterns(sortedPatterns);
        });
    }

    function renderBodyCanvas() {
        bodyCtx.clearRect(0, 0, bodyCanvas.width, bodyCanvas.height);

        bodyCtx.globalCompositeOperation = 'source-over';
        bodyCtx.drawImage(bodyImage, 0, 0, bodyCanvas.width, bodyCanvas.height);
        bodyCtx.globalCompositeOperation = 'source-in';
        bodyCtx.fillStyle = bodyColor;
        bodyCtx.fillRect(0, 0, bodyCanvas.width, bodyCanvas.height);

        renderPattern();
    }

    function renderBellyCanvas() {
        bellyCtx.clearRect(0, 0, bellyCanvas.width, bellyCanvas.height);

        bellyCtx.globalCompositeOperation = 'source-over';
        bellyCtx.drawImage(bellyImage, 0, 0, bellyCanvas.width, bellyCanvas.height);
        bellyCtx.globalCompositeOperation = 'source-in';
        bellyCtx.fillStyle = bellyColor;
        bellyCtx.fillRect(0, 0, bellyCanvas.width, bellyCanvas.height);
    }

    function renderPattern() {
        patternCtx.clearRect(0, 0, patternCanvas.width, patternCanvas.height);

        if (!selectedPattern) return;

        const patternImage = new Image();
        patternImage.src = `../assets/images/patterns/${selectedPattern}.png`;

        patternImage.onload = () => {
            patternCtx.globalCompositeOperation = 'source-over';
            patternCtx.drawImage(patternImage, 0, 0, patternCanvas.width, patternCanvas.height);
            patternCtx.globalCompositeOperation = 'source-in';
            patternCtx.fillStyle = selectedPatternColor;
            patternCtx.fillRect(0, 0, patternCanvas.width, patternCanvas.height);
            patternCtx.globalCompositeOperation = 'source-over';
            renderCosmetics(); // Ensure cosmetics are rendered on top
        };
    }

    function renderCosmetics() {
        cosmeticCtx.clearRect(0, 0, cosmeticCanvas.width, cosmeticCanvas.height);

        selectedCosmetics.forEach(cosmetic => {
            const cosmeticImage = new Image();
            cosmeticImage.src = `../assets/images/cosmetics/${cosmetic.image}`;
            cosmeticImage.onload = () => {
                const x = (cosmetic.position.x / 100) * cosmeticCanvas.width;
                const y = (cosmetic.position.y / 100) * cosmeticCanvas.height;
                const width = (cosmetic.position.width / 100) * cosmeticCanvas.width;
                const height = (cosmetic.position.height / 100) * cosmeticCanvas.height;

                cosmeticCtx.globalCompositeOperation = 'source-over';
                cosmeticCtx.drawImage(cosmeticImage, x, y, width, height);
            };
        });
    }

    function hexToHSL(hex) {
        // Convert hex to RGB
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        // Find greatest and smallest channel values
        let cmax = Math.max(r, g, b);
        let cmin = Math.min(r, g, b);
        let delta = cmax - cmin;
        let h = 0;
        let s = 0;
        let l = 0;

        // Calculate hue
        if (delta == 0)
            h = 0;
        else if (cmax == r)
            h = ((g - b) / delta) % 6;
        else if (cmax == g)
            h = (b - r) / delta + 2;
        else
            h = (r - g) / delta + 4;

        h = Math.round(h * 60);

        // Make negative hues positive behind 360°
        if (h < 0)
            h += 360;

        // Calculate lightness
        l = (cmax + cmin) / 2;

        // Calculate saturation
        s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

        // Multiply l and s by 100
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);

        return { h, s, l };
    }

    function formatName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    // Tab functionality
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.target;

            tabContents.forEach(content => {
                if (content.id === target) {
                    content.classList.add('active');
                } else {
                    content.classList.remove('active');
                }
            });
        });
    });

    // Initially show the body color tab
    document.querySelector('.tab-button[data-target="body-color"]').click();
});
