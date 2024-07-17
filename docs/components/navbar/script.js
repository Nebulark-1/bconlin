document.addEventListener('DOMContentLoaded', function() {
  const toggler = document.getElementById('navbar-toggler');
  const navbarCollapse = document.getElementById('navbar-collapse');
  const sidePanel = document.getElementById('side-panel');
  const closeBtn = document.getElementById('closebtn');

  // Navbar toggler for mobile view
  if (toggler && navbarCollapse) {
    toggler.addEventListener('click', function() {
      navbarCollapse.classList.toggle('active');

      // Toggle the sidebar as well
      if (sidePanel.style.width === '250px') {
        sidePanel.style.width = '0';
      } else {
        sidePanel.style.width = '250px';
      }
    });
  }

  // Close button for sidebar
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      sidePanel.style.width = '0';
    });
  }

  // Scroll effect for navbar
  window.addEventListener('scroll', function() {
    const startHeader = document.querySelector('.start-header');
    if (window.scrollY >= 10) {
      startHeader.classList.add('scroll-on');
    } else {
      startHeader.classList.remove('scroll-on');
    }
  });
});
