function toggleDropdown() {
    var sidebar = document.getElementById("mySidebar");
    if (sidebar.style.width === '250px') {
        sidebar.style.width = '0';
    } else {
        sidebar.style.width = '250px';
    }
}

// Close the dropdown if the user clicks outside of it
window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        var sidebar = document.getElementById("mySidebar");
        if (sidebar.style.width === '250px') {
            sidebar.style.width = '0';
        }
    }
}
