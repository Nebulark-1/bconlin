document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM fully loaded and parsed');
  
  const toggler = document.getElementById('navbar-toggler');
  const sidePanel = document.getElementById('side-panel');
  const closeBtn = document.getElementById('closebtn');

  if (!toggler || !sidePanel || !closeBtn) {
    console.error('One or more elements not found:', { toggler, sidePanel, closeBtn });
    return;
  }

  console.log('Adding click event listener to toggler');
  toggler.addEventListener('click', function() {
    if (sidePanel.style.width === '250px') {
      sidePanel.style.width = '0';
    } else {
      sidePanel.style.width = '250px';
    }
    console.log('Toggler clicked, side panel toggled');
  });

  console.log('Adding click event listener to close button');
  closeBtn.addEventListener('click', function() {
    sidePanel.style.width = '0';
    console.log('Close button clicked, side panel closed');
  });
});

