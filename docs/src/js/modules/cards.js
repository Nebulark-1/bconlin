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
      
      // Add click event listener to make the card fall
      if (card.id !== 'card6') { // Exclude resume card
        card.addEventListener('click', function() {
          card.style.setProperty('--spin-direction', Math.random() > 0.5 ? 1 : -1);
          card.classList.add('falling');
        });
        
        // Add animation end event listener to reset the card
        card.addEventListener('animationend', function(event) {
          if (event.animationName === 'fall') {
            console.log('Fall animation ended, triggering reappear...');
            card.classList.remove('falling');
            card.classList.add('reappear');
          } else if (event.animationName === 'reappear') {
            console.log('Reappear animation ended, resetting card...');
            card.classList.remove('reappear');
          }
        });
      }
    });
  }

  window.addEventListener('resize', updateCards);

  // Initial call to position cards
  updateCards();
});
