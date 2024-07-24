// src/js/modules/loadComponents.js

// Function to load a component
function loadComponent(elementId, url, callback) {
    fetch(url)
      .then(response => response.text())
      .then(data => {
        document.getElementById(elementId).innerHTML = data;
  
        if (callback) {
          callback();
        }
      })
      .catch(error => console.error('Error loading the component:', error));
  }
  
  // Load the navbar component
  loadComponent('navbar-placeholder', '../partials/navbar.html');
  
  // Load the background component
  loadComponent('background-placeholder', '../partials/background.html');
  