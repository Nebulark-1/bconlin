// src/js/modules/portfolio.js

document.addEventListener('DOMContentLoaded', function() {
    loadComponents();
    updateCards();
  });
  
  function loadComponents() {
    loadComponent('navbar-placeholder', '../partials/navbar.html');
    loadComponent('background-placeholder', '../partials/background.html');
  }
  
  function sortPortfolio(criteria) {
    const cardsContainer = document.getElementById('cards');
    const cards = Array.from(cardsContainer.querySelectorAll('.card'));
    
    cards.sort((a, b) => {
      let aValue = a.getAttribute(`data-${criteria}`);
      let bValue = b.getAttribute(`data-${criteria}`);
  
      if (criteria === 'date') {
        return new Date(aValue) - new Date(bValue);
      } else {
        return aValue - bValue;
      }
    });
  
    cards.forEach(card => cardsContainer.appendChild(card));
  }
  