function toggleDropdown() {
    var sidebar = document.getElementById("mySidebar");
    if (sidebar.style.width === '150px') {
        sidebar.style.width = '0';
    } else {
        sidebar.style.width = '150px';
    }
}

// Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        var sidebar = document.getElementById("mySidebar");
        if (sidebar.style.width === '150px') {
            sidebar.style.width = '0';
        }
    }
}

//Maze Background

const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

const cols = 50;
const cellSize = Math.floor(window.innerWidth / cols);
canvas.width = cellSize * cols;
canvas.height = document.body.offsetHeight;

const rows = Math.floor(canvas.height / cellSize);
const maze = [];
let stack = [];
const wallThickness = cellSize / 6;

for (let y = 0; y < rows; y++) {
    maze[y] = [];
    for (let x = 0; x < cols; x++) {
        maze[y][x] = {
            x: x,
            y: y,
            walls: [true, true, true, true],
            visited: false,
        };
    }
}

let current = maze[0][0];
current.visited = true;
stack.push(current);

while (stack.length > 0) {
    let next = stack.pop();
    if (next) {
        current = next;
        const {x, y} = current;
        let directions = [[1, 0], [0, 1], [-1, 0], [0, -1]]; 
        let neighbors = [];

        for (let [dx, dy] of directions) {
            const nx = x + dx, ny = y + dy;
            if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && !maze[ny][nx].visited) {
                neighbors.push(maze[ny][nx]);
            }
        }

        if (neighbors.length > 0) {
            stack.push(current);
            let next = neighbors[Math.floor(Math.random() * neighbors.length)];

            if (next.x === x + 1) { current.walls[1] = false; next.walls[3] = false; }
            if (next.x === x - 1) { current.walls[3] = false; next.walls[1] = false; }
            if (next.y === y + 1) { current.walls[2] = false; next.walls[0] = false; }
            if (next.y === y - 1) { current.walls[0] = false; next.walls[2] = false; }

            next.visited = true;
            stack.push(next);
        }
    }
}

drawMaze();

function drawWall(x1, y1, x2, y2) {
    // Draw the main line of the wall
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = wallThickness;
    ctx.stroke();

    // Draw rounded ends
    ctx.beginPath();
    ctx.arc(x1, y1, wallThickness / 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x2, y2, wallThickness / 2, 0, 2 * Math.PI);
    ctx.fill();
}

function drawMaze() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = maze[y][x];
            const x1 = x * cellSize;
            const y1 = y * cellSize;
            const x2 = x1 + cellSize;
            const y2 = y1 + cellSize;

            // Draw walls with rounded ends
            if (cell.walls[0]) drawWall(x1, y1, x2, y1); // Top
            if (cell.walls[1]) drawWall(x2, y1, x2, y2); // Right
            if (cell.walls[2]) drawWall(x1, y2, x2, y2); // Bottom
            if (cell.walls[3]) drawWall(x1, y1, x1, y2); // Left
        }
    }
}

// Redraw the maze when the window is resized
window.addEventListener('resize', function() {
    // Clear the existing canvas
    var canvas = document.getElementById('yourCanvasId');
    var ctx = canvas.getContext('2d');

    // Adjust canvas size if necessary
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw the maze
    drawMaze();
});

// Home Section Animation
document.addEventListener('scroll', function() {
    var homeSection = document.getElementById('home');
    var imageBox = homeSection.querySelector('.image-box');
    var textBox = homeSection.querySelector('.text-box');

    if (window.scrollY > 0) {
        imageBox.classList.add('move-left');
        textBox.classList.add('move-right');
    } else {
        imageBox.classList.remove('move-left');
        textBox.classList.remove('move-right');
    }
});
