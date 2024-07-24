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
    let aValue = a.getAttribute(`data-${criteria}`).toLowerCase();
    let bValue = b.getAttribute(`data-${criteria}`).toLowerCase();

    if (criteria === 'date') {
      return new Date(aValue) - new Date(bValue);
    } else if (criteria === 'technicalDifficulty' || criteria === 'scale') {
      return parseInt(aValue) - parseInt(bValue);
    } else {
      return aValue.localeCompare(bValue);
    }
  });

  cards.forEach(card => cardsContainer.appendChild(card));
}

function updateCards() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.style.width = '60vw';
    card.style.margin = '20px auto';
  });
}
