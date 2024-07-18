// components/cards/cards.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('Cards script loaded');
  
    function positionCard(card) {
      const width = card.getAttribute('data-width');
      const height = card.getAttribute('data-height');
      const topRatio = card.getAttribute('data-top-ratio');
      const leftRatio = card.getAttribute('data-left-ratio');
      
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
  
      const top = windowHeight * topRatio;
      const left = windowWidth * leftRatio;
  
      card.style.width = `${width}px`;
      card.style.height = `${height}px`;
      card.style.top = `${top}px`;
      card.style.left = `${left}px`;
      card.style.transform = 'translate(-50%, 0)'; // Center the card horizontally
      console.log(`Positioned card with content: ${card.innerHTML}, top=${top}, left=${left}, width=${width}, height=${height}`);
    }
  
    function updateCards() {
      console.log('Updating cards...');
      const cardsContainer = document.getElementById('cards');
      if (!cardsContainer) {
        console.error('Cards container not found');
        return;
      }
  
      const cards = cardsContainer.querySelectorAll('.card');
      cards.forEach(card => {
        console.log('Processing card:', card);
        positionCard(card);
      });
    }
  
    window.addEventListener('resize', updateCards);
  
    // Initial call to position cards
    updateCards();
  });
  