// src/js/modules/cards.js
document.addEventListener('DOMContentLoaded', function() {
  function positionCard(card) {
    const width = card.getAttribute('data-width');
    const height = card.getAttribute('data-height');
    const topRatio = parseFloat(card.getAttribute('data-top-ratio'));
    const leftRatio = parseFloat(card.getAttribute('data-left-ratio'));
    
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const referenceWidth = 1920;
    const top = (windowHeight * topRatio) / (referenceWidth / windowWidth);
    const left = windowWidth * leftRatio;

    card.style.width = `${width}vw`;
    card.style.height = `2.09*${height}vh`;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.marginTop = '8vh'; // Add 8vh buffer from navbar


    if (windowWidth <= 720) {
      // For mobile layout, remove top positioning and center cards
      card.style.top = 'auto';
      card.style.left = '50%';
      card.style.marginBottom = '8vh'; // Add 8vh buffer between cards

      // Specific adjustments for smaller screens
      if (card.id === 'card2') {
        card.style.width = '85vw';
        card.style.left = '7.5vw'; // Center at 40vw
        card.style.top = '5vh'; // 5vh from the navbar
      } else if (card.id === 'card6') {
        card.style.width = '30vw';
        card.style.left = '67.5vw'; // Center at 70vw
        card.style.top = '3vh'; // 20vh from the navbar
      } else if (card.id === 'card4') {
        card.style.width = '90vw';
        card.style.left = '5vw'; // Center at 50vw
        card.style.top = '100vw'; // 50vh from the navbar
      }
    } else {
      // Reset styles for larger screens
      card.style.transform = 'none';
      card.style.marginTop = '8vh';
      card.style.marginBottom = '0';
    }

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

      if (card.id !== 'card6') {
        card.addEventListener('click', function() {
          card.style.setProperty('--spin-direction', Math.random() > 0.5 ? 1 : -1);
          card.classList.add('falling');
        });

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

  updateCards();
});
